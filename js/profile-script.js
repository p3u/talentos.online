// Ensure Supabase library is loaded from HTML before this script runs
const SUPABASE_URL = 'https://kyeyxkzvvxcypyjsfuzu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5ZXl4a3p2dnhjeXB5anNmdXp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxNDczNzAsImV4cCI6MjA2MjcyMzM3MH0.H3ZS35V1vxU9TLRAzi10kOiFdZcZtKlAX9bJ0DVKrAc';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const loginButton = document.getElementById('loginButton');
const logoutButton = document.getElementById('logoutButton');
const loginAreaDiv = document.getElementById('loginArea');
const userInfoDiv = document.getElementById('userInfo');
const userNameSpan = document.getElementById('userName');
const userAvatarImg = document.getElementById('userAvatar');
const authMessageP = document.getElementById('authMessage');

const celebrationSection = document.getElementById('celebrationSection'); // For the "Parabéns" header
const profileSection = document.getElementById('profileSection');
const actionsSection = document.getElementById('actionsSection');
const profileForm = document.getElementById('profileForm');

// Note: Indications display elements (indicationsCountSpan, etc.) are removed from this page's direct JS logic

let currentUser = null;
let userProfileDataFromDB = null;

// --- Authentication Functions ---
async function signInWithLinkedIn() {
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'linkedin_oidc',
        options: {
            redirectTo: window.location.href,
            scopes: 'openid profile email'
        }
    });
    if (error) {
        console.error('Error initiating LinkedIn login:', error);
        alert(`Error during login: ${error.message}`);
    }
}

async function signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        console.error('Error during logout:', error);
        alert(`Error during logout: ${error.message}`);
    }
}

// --- Profile Management Functions ---
async function loadOrCreateUserProfile(user) {
    const { data: profile, error } = await supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user profile:', error);
        return null;
    }

    if (profile) {
        console.log("Existing profile found:", profile);
        userProfileDataFromDB = profile;
        populateProfileForm(profile);
        return profile;
    } else {
        console.log("No existing profile, creating a new one for user:", user.id);
        const linkedInIdentity = user.identities?.find(id => id.provider === 'linkedin' || id.provider === 'linkedin_oidc');
        const newProfileData = {
            id: user.id,
            full_name: user.user_metadata?.full_name || user.email,
            email: user.email,
            avatar_url: linkedInIdentity?.identity_data?.picture || user.user_metadata?.avatar_url,
            linkedin_user_id: linkedInIdentity?.id || null
            // my_linkedin_vanity is no longer automatically set here, nor is it an input on this specific form
        };
        const { data: createdProfile, error: createError } = await supabaseClient
            .from('user_profiles')
            .insert(newProfileData)
            .select()
            .single();

        if (createError) {
            console.error("Error creating initial user profile:", createError);
            return null;
        }
        console.log("Initial profile created:", createdProfile);
        userProfileDataFromDB = createdProfile;
        populateProfileForm(createdProfile);
        return createdProfile;
    }
}

function populateProfileForm(profile) {
    if (!profile || !profileForm) return;

    // The my_linkedin_vanity input field was removed from profile.html
    // if(profileForm.elements.my_linkedin_vanity) profileForm.elements.my_linkedin_vanity.value = profile.my_linkedin_vanity || '';

    if(profileForm.elements.current_salary) profileForm.elements.current_salary.value = profile.current_salary || '';
    if(profileForm.elements.desired_salary) profileForm.elements.desired_salary.value = profile.desired_salary || '';
    if(profileForm.elements.skills) profileForm.elements.skills.value = (profile.skills || []).join(', ');
    if(profileForm.elements.desired_role_type) profileForm.elements.desired_role_type.value = profile.desired_role_type || '';
    if(profileForm.elements.desired_companies) profileForm.elements.desired_companies.value = (profile.desired_companies || []).join(', ');
}

// --- UI Update and Event Listeners ---
async function handleAuthStateChange(user) {
    currentUser = user;
    if (user) {
        const linkedInIdentityData = user.identities?.find(id => id.provider === 'linkedin' || id.provider === 'linkedin_oidc')?.identity_data;

        if(loginAreaDiv) loginAreaDiv.style.display = 'none';
        if(userInfoDiv) userInfoDiv.style.display = 'flex';
        if(logoutButton) logoutButton.style.display = 'inline-flex';

        if(userAvatarImg) userAvatarImg.src = linkedInIdentityData?.picture || user.user_metadata?.avatar_url || 'https://placehold.co/50x50/0077b5/FFFFFF?text=LI&font=poppins';
        if(userNameSpan) userNameSpan.textContent = linkedInIdentityData?.name || user.user_metadata?.full_name || user.email;

        if(authMessageP) authMessageP.style.display = 'none';

        if(celebrationSection) celebrationSection.style.display = 'block'; // Show celebration header
        if(profileSection) profileSection.style.display = 'block';
        if(actionsSection) actionsSection.style.display = 'block';

        await loadOrCreateUserProfile(user);
        // Indication fetching logic is removed from this page.

    } else {
        if(loginAreaDiv) loginAreaDiv.style.display = 'block';
        if(userInfoDiv) userInfoDiv.style.display = 'none';
        if(logoutButton) logoutButton.style.display = 'none';
        if(authMessageP) {
            authMessageP.textContent = 'Para gerenciar seu perfil e informar suas preferências, por favor, faça login com sua conta do LinkedIn.';
            authMessageP.style.display = 'block';
        }

        if(celebrationSection) celebrationSection.style.display = 'none'; // Hide celebration
        if(profileSection) profileSection.style.display = 'none';
        if(actionsSection) actionsSection.style.display = 'none';

        if(profileForm) profileForm.reset();
        userProfileDataFromDB = null;
    }
}

supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('Auth Event on Profile Page:', event, 'Session:', session);
    handleAuthStateChange(session ? session.user : null);
});

if (loginButton) {
    loginButton.addEventListener('click', signInWithLinkedIn);
}

if (logoutButton) {
    logoutButton.addEventListener('click', signOut);
}

if (profileForm) {
    profileForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!currentUser) {
            alert("Você precisa estar logado para salvar o perfil.");
            return;
        }

        const submitProfileButton = profileForm.querySelector('button[type="submit"]');
        const originalButtonText = submitProfileButton.textContent;
        submitProfileButton.disabled = true;
        submitProfileButton.innerHTML = 'Salvando... <span class="spinner"></span>';

        // my_linkedin_vanity is no longer read from this form.
        // It will be handled on the view-my-referrals.html page or if fetched automatically later.
        // We save whatever is currently in the user's profile for this field, or null.
        const myLinkedInVanityToSave = userProfileDataFromDB?.my_linkedin_vanity || null;

        const linkedInIdentity = currentUser.identities?.find(id => id.provider === 'linkedin' || id.provider === 'linkedin_oidc');

        const profileDataToSave = {
            id: currentUser.id,
            my_linkedin_vanity: myLinkedInVanityToSave, // Preserves existing or null
            current_salary: profileForm.elements.current_salary.value ? parseFloat(profileForm.elements.current_salary.value) : null,
            desired_salary: profileForm.elements.desired_salary.value ? parseFloat(profileForm.elements.desired_salary.value) : null,
            skills: profileForm.elements.skills.value.split(',').map(s => s.trim()).filter(s => s.length > 0),
            desired_role_type: profileForm.elements.desired_role_type.value.trim() || null,
            desired_companies: profileForm.elements.desired_companies.value.split(',').map(s => s.trim()).filter(s => s.length > 0),
            updated_at: new Date().toISOString(),
            full_name: linkedInIdentity?.identity_data?.name || currentUser.user_metadata?.full_name || currentUser.email,
            email: currentUser.email,
            avatar_url: linkedInIdentity?.identity_data?.picture || currentUser.user_metadata?.avatar_url,
            linkedin_user_id: linkedInIdentity?.id || null
        };

        console.log("Attempting to save profile data:", profileDataToSave);

        const { data, error } = await supabaseClient
            .from('user_profiles')
            .upsert(profileDataToSave, { onConflict: 'id' })
            .select()
            .single();

        if (error) {
            console.error('Error saving profile:', error);
            alert(`Erro ao salvar perfil: ${error.message}`);
        } else {
            console.log('Profile saved successfully:', data);
            userProfileDataFromDB = data;
            alert('Perfil salvo com sucesso!');
        }
        submitProfileButton.disabled = false;
        submitProfileButton.textContent = originalButtonText;
    });
}

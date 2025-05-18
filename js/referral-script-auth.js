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

const profileSection = document.getElementById('profileSection');
// const indicationsSection = document.getElementById('indicationsSection'); // Section removed from HTML
const actionsSection = document.getElementById('actionsSection');
const profileForm = document.getElementById('profileForm');

// Indications display elements are removed
// const indicationsCountSpan = document.getElementById('indicationsCount');
// const indicatedAreasListUl = document.getElementById('indicatedAreasList');
// const noIndicationsMessageLi = document.getElementById('noIndicationsMessage');

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
            avatar_url: linkedInIdentity?.identity_data?.picture || user.user_metadata?.avatar_url, // Use picture from identity_data
            linkedin_user_id: linkedInIdentity?.id || null
            // my_linkedin_vanity will be filled by the user in the form
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

    if(profileForm.elements.my_linkedin_vanity) profileForm.elements.my_linkedin_vanity.value = profile.my_linkedin_vanity || '';
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

        // Use picture from LinkedIn identity data if available for avatar
        if(userAvatarImg) userAvatarImg.src = linkedInIdentityData?.picture || user.user_metadata?.avatar_url || 'https://placehold.co/50x50/0077b5/FFFFFF?text=LI&font=poppins';
        if(userNameSpan) userNameSpan.textContent = linkedInIdentityData?.name || user.user_metadata?.full_name || user.email; // Prefer name from identity_data

        if(authMessageP) authMessageP.style.display = 'none';

        if(profileSection) profileSection.style.display = 'block';
        // Make sure indicationsSection (if it exists in HTML) is handled or removed if not used
        const indicationsSectionEl = document.getElementById('indicationsSection');
        if(indicationsSectionEl) indicationsSectionEl.style.display = 'none'; // Explicitly hide if it was part of old HTML

        if(actionsSection) actionsSection.style.display = 'block';

        await loadOrCreateUserProfile(user);
        // No longer fetching indications here automatically.
        // User will click a button to go to a new page for that.

    } else {
        if(loginAreaDiv) loginAreaDiv.style.display = 'block';
        if(userInfoDiv) userInfoDiv.style.display = 'none';
        if(logoutButton) logoutButton.style.display = 'none';
        if(authMessageP) {
            authMessageP.textContent = 'Para gerenciar seu perfil e informar suas preferências, por favor, faça login com sua conta do LinkedIn.';
            authMessageP.style.display = 'block';
        }

        if(profileSection) profileSection.style.display = 'none';
        const indicationsSectionEl = document.getElementById('indicationsSection');
        if(indicationsSectionEl) indicationsSectionEl.style.display = 'none';

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

        const myLinkedInVanity = profileForm.elements.my_linkedin_vanity.value.trim() || null;
        const linkedInIdentity = currentUser.identities?.find(id => id.provider === 'linkedin' || id.provider === 'linkedin_oidc');

        const profileDataToSave = {
            id: currentUser.id,
            my_linkedin_vanity: myLinkedInVanity,
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
            // No need to fetch indications here anymore
        }
        submitProfileButton.disabled = false;
        submitProfileButton.textContent = originalButtonText;
    });
}

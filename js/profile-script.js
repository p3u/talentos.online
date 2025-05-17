// Ensure Supabase library is loaded from HTML before this script runs
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

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
const authMessageP = document.getElementById('authMessage'); // For messages in the auth section

const profileSection = document.getElementById('profileSection');
const indicationsSection = document.getElementById('indicationsSection');
const actionsSection = document.getElementById('actionsSection');
const profileForm = document.getElementById('profileForm');

const indicationsCountSpan = document.getElementById('indicationsCount');
const indicatedAreasListUl = document.getElementById('indicatedAreasList');
const noIndicationsMessageLi = document.getElementById('noIndicationsMessage');

let currentUser = null;
let userProfileData = null; // To store the fetched/created user profile from user_profiles table

// --- Authentication Functions ---
async function signInWithLinkedIn() {
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'linkedin_oidc', // Make sure this matches your Supabase provider config
        options: {
            redirectTo: window.location.href, // Redirects back to the current page
            scopes: 'openid profile email' // Standard OIDC scopes
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
    // UI update will be handled by onAuthStateChange
}

// --- Data Fetching and Profile Management Functions ---
async function fetchUserIndications(loggedInUserVanityName) {
    // Ensure elements exist before trying to update them
    if (!indicationsCountSpan || !indicatedAreasListUl || !noIndicationsMessageLi) {
        console.warn("Indication display elements not found in the DOM.");
        return;
    }

    if (!loggedInUserVanityName) {
        indicationsCountSpan.textContent = '0';
        noIndicationsMessageLi.textContent = 'Por favor, preencha seu "LinkedIn Vanity Name" no perfil para buscar suas indicações.';
        noIndicationsMessageLi.style.display = 'list-item';
        indicatedAreasListUl.innerHTML = ''; // Clear previous list
        indicatedAreasListUl.appendChild(noIndicationsMessageLi);
        return;
    }

    console.log(`Fetching indications for LinkedIn Vanity Name: ${loggedInUserVanityName}`);

    const { data: indications, error: indicationsError } = await supabaseClient
        .from('indicacoes') // Your referrals table
        .select('areas_destaque')
        // Match against the 'indicado_linkedin_vanity' column you created in 'indicacoes'
        .eq('indicado_linkedin_vanity', loggedInUserVanityName);

    if (indicationsError) {
        console.error('Error fetching indications:', indicationsError);
        indicationsCountSpan.textContent = 'Erro';
        noIndicationsMessageLi.textContent = 'Não foi possível carregar as áreas indicadas.';
        noIndicationsMessageLi.style.display = 'list-item';
        indicatedAreasListUl.innerHTML = '';
        indicatedAreasListUl.appendChild(noIndicationsMessageLi);
    } else if (indications && indications.length > 0) {
        indicationsCountSpan.textContent = indications.length;
        const allAreas = indications.flatMap(ind => ind.areas_destaque || []);
        const uniqueAreas = [...new Set(allAreas.filter(area => area))];

        if (uniqueAreas.length > 0) {
            noIndicationsMessageLi.style.display = 'none';
            indicatedAreasListUl.innerHTML = uniqueAreas.map(area => `<li>${area}</li>`).join('');
        } else {
            noIndicationsMessageLi.textContent = 'Você foi indicado(a), mas sem áreas específicas mencionadas.';
            noIndicationsMessageLi.style.display = 'list-item';
            indicatedAreasListUl.innerHTML = '';
            indicatedAreasListUl.appendChild(noIndicationsMessageLi);
        }
    } else {
        indicationsCountSpan.textContent = '0';
        noIndicationsMessageLi.textContent = 'Nenhuma indicação encontrada para seu LinkedIn Vanity Name no momento.';
        noIndicationsMessageLi.style.display = 'list-item';
        indicatedAreasListUl.innerHTML = '';
        indicatedAreasListUl.appendChild(noIndicationsMessageLi);
    }
}

async function loadOrCreateUserProfile(user) {
    const { data: profile, error } = await supabaseClient
        .from('user_profiles') // Your user profiles table
        .select('*')
        .eq('id', user.id) // Supabase auth user ID is the primary key
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: no rows found, which is fine
        console.error('Error fetching user profile:', error);
        return null;
    }

    if (profile) {
        console.log("Existing profile found:", profile);
        userProfileData = profile; // Store fetched profile
        populateProfileForm(profile);
        return profile;
    } else {
        // Profile doesn't exist, create a basic one
        console.log("No existing profile, creating a new one for user:", user.id);
        const linkedInIdentity = user.identities?.find(id => id.provider === 'linkedin' || id.provider === 'linkedin_oidc');
        const newProfileData = {
            id: user.id,
            full_name: user.user_metadata?.full_name || user.email,
            email: user.email,
            avatar_url: user.user_metadata?.avatar_url,
            linkedin_user_id: linkedInIdentity?.id || null // Store LinkedIn's unique ID for this user
            // my_linkedin_vanity will be null initially, user needs to fill it.
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
        userProfileData = createdProfile; // Store newly created profile
        populateProfileForm(createdProfile); // Populate form with (mostly empty) new profile
        return createdProfile;
    }
}

function populateProfileForm(profile) {
    if (!profile || !profileForm) return;
    // Populate LinkedIn Vanity Name
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
        if(loginAreaDiv) loginAreaDiv.style.display = 'none';
        if(userInfoDiv) userInfoDiv.style.display = 'flex';
        if(logoutButton) logoutButton.style.display = 'inline-flex';
        if(userNameSpan) userNameSpan.textContent = user.user_metadata?.full_name || user.email;
        if(userAvatarImg) userAvatarImg.src = user.user_metadata?.avatar_url || 'https://placehold.co/50x50/0077b5/FFFFFF?text=LI&font=poppins';
        if(authMessageP) authMessageP.style.display = 'none'; // Hide initial auth message

        if(profileSection) profileSection.style.display = 'block';
        if(indicationsSection) indicationsSection.style.display = 'block';
        if(actionsSection) actionsSection.style.display = 'block';

        const fetchedProfile = await loadOrCreateUserProfile(user);
        // Fetch indications based on the vanity name stored in the user's profile
        if (fetchedProfile && fetchedProfile.my_linkedin_vanity) {
            await fetchUserIndications(fetchedProfile.my_linkedin_vanity);
        } else if (fetchedProfile) {
            // User has a profile but no vanity name set yet
            if(indicationsCountSpan) indicationsCountSpan.textContent = '0';
            if (noIndicationsMessageLi) {
                noIndicationsMessageLi.textContent = 'Adicione seu "LinkedIn Vanity Name" no perfil para buscar suas indicações.';
                noIndicationsMessageLi.style.display = 'list-item';
            }
            if(indicatedAreasListUl) indicatedAreasListUl.innerHTML = '';
            if (noIndicationsMessageLi && indicatedAreasListUl) indicatedAreasListUl.appendChild(noIndicationsMessageLi);
        }

    } else { // User is not logged in
        if(loginAreaDiv) loginAreaDiv.style.display = 'block';
        if(userInfoDiv) userInfoDiv.style.display = 'none';
        if(logoutButton) logoutButton.style.display = 'none';
        if(authMessageP) authMessageP.style.display = 'block'; // Show initial auth message

        if(profileSection) profileSection.style.display = 'none';
        if(indicationsSection) indicationsSection.style.display = 'none';
        if(actionsSection) actionsSection.style.display = 'none';

        if(indicationsCountSpan) indicationsCountSpan.textContent = '0';
        if(indicatedAreasListUl && noIndicationsMessageLi) {
            noIndicationsMessageLi.textContent = 'Faça login para ver suas indicações.';
            noIndicationsMessageLi.style.display = 'list-item';
            indicatedAreasListUl.innerHTML = '';
            indicatedAreasListUl.appendChild(noIndicationsMessageLi);
        }
        if(profileForm) profileForm.reset();
        userProfileData = null; // Clear profile data on logout
    }
}

// Listen for authentication state changes
supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('Auth Event on Profile Page:', event, 'Session:', session);
    handleAuthStateChange(session ? session.user : null);
});

// Login button event listener
if (loginButton) {
    loginButton.addEventListener('click', signInWithLinkedIn);
}

// Logout button event listener
if (logoutButton) {
    logoutButton.addEventListener('click', signOut);
}

// Profile form submission
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

        // Get the vanity name from the form
        const myLinkedInVanity = profileForm.elements.my_linkedin_vanity.value.trim() || null;

        const profileDataToSave = {
            id: currentUser.id, // Primary key
            my_linkedin_vanity: myLinkedInVanity, // Save the new vanity name field
            current_salary: profileForm.elements.current_salary.value ? parseFloat(profileForm.elements.current_salary.value) : null,
            desired_salary: profileForm.elements.desired_salary.value ? parseFloat(profileForm.elements.desired_salary.value) : null,
            skills: profileForm.elements.skills.value.split(',').map(s => s.trim()).filter(s => s.length > 0),
            desired_role_type: profileForm.elements.desired_role_type.value.trim() || null,
            desired_companies: profileForm.elements.desired_companies.value.split(',').map(s => s.trim()).filter(s => s.length > 0),
            updated_at: new Date().toISOString(),
            // Keep/update LinkedIn data if already present, or update if available
            full_name: currentUser.user_metadata?.full_name || currentUser.email,
            email: currentUser.email,
            avatar_url: currentUser.user_metadata?.avatar_url,
            linkedin_user_id: currentUser.identities?.find(id => id.provider === 'linkedin' || id.provider === 'linkedin_oidc')?.id || null
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
            userProfileData = data; // Update local cache of profile data
            alert('Perfil salvo com sucesso!');
            // After saving, try to fetch indications again with the new/updated vanity name
            if (userProfileData && userProfileData.my_linkedin_vanity) {
                await fetchUserIndications(userProfileData.my_linkedin_vanity);
            } else {
                 if(indicationsCountSpan) indicationsCountSpan.textContent = '0';
                 if (noIndicationsMessageLi) {
                    noIndicationsMessageLi.textContent = 'Adicione seu "LinkedIn Vanity Name" para buscar suas indicações.';
                    noIndicationsMessageLi.style.display = 'list-item';
                 }
                 if(indicatedAreasListUl) indicatedAreasListUl.innerHTML = '';
                 if (noIndicationsMessageLi && indicatedAreasListUl) indicatedAreasListUl.appendChild(noIndicationsMessageLi);
            }
        }
        submitProfileButton.disabled = false;
        submitProfileButton.textContent = originalButtonText;
    });
}

// The onAuthStateChange listener handles the initial check for a session.

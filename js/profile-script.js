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
const indicationsSection = document.getElementById('indicationsSection');
const actionsSection = document.getElementById('actionsSection');
const profileForm = document.getElementById('profileForm');

const indicationsCountSpan = document.getElementById('indicationsCount');
const indicatedAreasListUl = document.getElementById('indicatedAreasList');
const noIndicationsMessageLi = document.getElementById('noIndicationsMessage');

let currentUser = null;
let userProfileData = null;
let userLinkedInVanityName = null; // Store the extracted/fetched vanity name

// --- LinkedIn URL Parsing Function (Client-Side) ---
function extractVanityFromLinkedInURL(url) {
    if (!url || typeof url !== 'string') return null;
    try {
        // Normalize URL slightly (e.g., remove query params, hash, trailing slash)
        const urlObj = new URL(url);
        let path = urlObj.pathname; // Gets the path part, e.g., /in/vanityname/ or /in/vanityname
        path = path.replace(/\/$/, ''); // Remove trailing slash

        const match = path.match(/^\/in\/([^/]+)/i); // Starts with /in/ followed by non-slash characters
        if (match && match[1]) {
            return match[1];
        }
        // Fallback for /pub/ format
        const pubMatch = path.match(/^\/pub\/([^/]+)/i);
        if (pubMatch && pubMatch[1]) {
            return pubMatch[1];
        }
    } catch (e) {
        console.warn("Error parsing URL for vanity name:", url, e);
    }
    return null;
}


// --- Authentication Functions ---
async function signInWithLinkedIn() {
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'linkedin_oidc',
        options: {
            redirectTo: window.location.href,
            scopes: 'openid profile email' // Standard OIDC scopes
        }
    });
    if (error) console.error('Error initiating LinkedIn login:', error);
}

async function signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) console.error('Error during logout:', error);
}

// --- Data Fetching and Profile Management Functions ---
async function fetchUserIndications(vanityNameToSearch) {
    // ... (Keep existing fetchUserIndications logic, it will use vanityNameToSearch) ...
    if (!indicationsCountSpan || !indicatedAreasListUl || !noIndicationsMessageLi) return;

    if (!vanityNameToSearch) {
        indicationsCountSpan.textContent = '0';
        noIndicationsMessageLi.textContent = 'Seu LinkedIn Vanity Name não foi encontrado para buscar indicações.';
        noIndicationsMessageLi.style.display = 'list-item';
        indicatedAreasListUl.innerHTML = '';
        if (noIndicationsMessageLi) indicatedAreasListUl.appendChild(noIndicationsMessageLi);
        return;
    }
    console.log(`Fetching indications for LinkedIn Vanity Name: ${vanityNameToSearch}`);
    const { data: indications, error: indicationsError } = await supabaseClient
        .from('indicacoes')
        .select('areas_destaque')
        .eq('indicado_linkedin_vanity', vanityNameToSearch);

    if (indicationsError) {
        console.error('Error fetching indications:', indicationsError);
        indicationsCountSpan.textContent = 'Erro';
        noIndicationsMessageLi.textContent = 'Não foi possível carregar as áreas indicadas.';
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
    let { data: profile, error } = await supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user profile:', error);
        return null;
    }

    // Attempt to get vanity name from existing profile or user_metadata
    let vanityName = profile?.my_linkedin_vanity || null;
    let profileUrlFromProvider = null;

    if (!vanityName) {
        // Check common places in user_metadata or identity_data for a profile URL
        profileUrlFromProvider = user.user_metadata?.profile_url || // Common custom claim
                                 user.user_metadata?.link ||        // Another common one
                                 user.user_metadata?.profile;       // OIDC standard 'profile' claim

        const linkedInIdentity = user.identities?.find(id => id.provider === 'linkedin' || id.provider === 'linkedin_oidc');
        if (!profileUrlFromProvider && linkedInIdentity?.identity_data?.profile) {
            profileUrlFromProvider = linkedInIdentity.identity_data.profile;
        }

        if (profileUrlFromProvider) {
            console.log("Found profile URL from provider data:", profileUrlFromProvider);
            vanityName = extractVanityFromLinkedInURL(profileUrlFromProvider);
            console.log("Extracted vanity name from provider URL:", vanityName);
        }
    }

    userLinkedInVanityName = vanityName; // Store globally for use in form submission if needed

    if (profile) {
        console.log("Existing profile found:", profile);
        userProfileData = { ...profile, my_linkedin_vanity: vanityName || profile.my_linkedin_vanity };

        // If vanity name was newly extracted and different from stored, update profile
        if (vanityName && vanityName !== profile.my_linkedin_vanity) {
            console.log("Updating profile with newly extracted vanity name:", vanityName);
            const { data: updatedProfile, error: updateError } = await supabaseClient
                .from('user_profiles')
                .update({ my_linkedin_vanity: vanityName, updated_at: new Date().toISOString() })
                .eq('id', user.id)
                .select()
                .single();
            if (updateError) {
                console.error("Error updating profile with extracted vanity name:", updateError);
            } else {
                userProfileData = updatedProfile;
                console.log("Profile updated with vanity name:", updatedProfile);
            }
        }
        populateProfileForm(userProfileData);
        return userProfileData;
    } else {
        console.log("No existing profile, creating a new one for user:", user.id);
        const linkedInIdentity = user.identities?.find(id => id.provider === 'linkedin' || id.provider === 'linkedin_oidc');
        const newProfileData = {
            id: user.id,
            full_name: user.user_metadata?.full_name || user.email,
            email: user.email,
            avatar_url: user.user_metadata?.avatar_url,
            linkedin_user_id: linkedInIdentity?.id || null,
            my_linkedin_vanity: vanityName // Save extracted vanity name on creation
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
        userProfileData = createdProfile;
        populateProfileForm(createdProfile);
        return createdProfile;
    }
}

function populateProfileForm(profile) {
    if (!profile || !profileForm) return;
    // The my_linkedin_vanity field was removed from the form,
    // as we are now trying to get it automatically.
    // We could display it if we have it:
    // const vanityDisplayElement = document.getElementById('displayedVanityName'); // Assuming you add such an element
    // if (vanityDisplayElement && profile.my_linkedin_vanity) {
    //     vanityDisplayElement.textContent = `Your LinkedIn Vanity: ${profile.my_linkedin_vanity}`;
    // }

    if(profileForm.elements.current_salary) profileForm.elements.current_salary.value = profile.current_salary || '';
    if(profileForm.elements.desired_salary) profileForm.elements.desired_salary.value = profile.desired_salary || '';
    if(profileForm.elements.skills) profileForm.elements.skills.value = (profile.skills || []).join(', ');
    if(profileForm.elements.desired_role_type) profileForm.elements.desired_role_type.value = profile.desired_role_type || '';
    if(profileForm.elements.desired_companies) profileForm.elements.desired_companies.value = (profile.desired_companies || []).join(', ');
}

async function handleAuthStateChange(user) {
    currentUser = user;
    if (user) {
        // --- LOGGING USER OBJECT ---
        console.log("Full Supabase User Object:", JSON.parse(JSON.stringify(user))); // Deep copy for full inspection
        console.log("User Metadata:", user.user_metadata);
        if (user.identities && user.identities.length > 0) {
            console.log("User Identities:", user.identities);
            console.log("LinkedIn Identity Data (if available):", user.identities.find(id => id.provider === 'linkedin' || id.provider === 'linkedin_oidc')?.identity_data);
        }
        // --- END LOGGING ---

        if(loginAreaDiv) loginAreaDiv.style.display = 'none';
        if(userInfoDiv) userInfoDiv.style.display = 'flex';
        if(logoutButton) logoutButton.style.display = 'inline-flex';
        if(userNameSpan) userNameSpan.textContent = user.user_metadata?.full_name || user.email;
        if(userAvatarImg) userAvatarImg.src = user.user_metadata?.avatar_url || 'https://placehold.co/50x50/0077b5/FFFFFF?text=LI&font=poppins';
        if(authMessageP) authMessageP.style.display = 'none';

        if(profileSection) profileSection.style.display = 'block';
        if(indicationsSection) indicationsSection.style.display = 'block';
        if(actionsSection) actionsSection.style.display = 'block';

        const fetchedFullProfile = await loadOrCreateUserProfile(user);
        if (fetchedFullProfile && fetchedFullProfile.my_linkedin_vanity) {
            await fetchUserIndications(fetchedFullProfile.my_linkedin_vanity);
        } else {
            if(indicationsCountSpan) indicationsCountSpan.textContent = '0';
            if (noIndicationsMessageLi) {
                noIndicationsMessageLi.textContent = fetchedFullProfile ? 'Seu LinkedIn Vanity Name não pôde ser determinado automaticamente.' : 'Carregando perfil...';
                noIndicationsMessageLi.style.display = 'list-item';
            }
            if(indicatedAreasListUl) indicatedAreasListUl.innerHTML = '';
            if (noIndicationsMessageLi && indicatedAreasListUl) indicatedAreasListUl.appendChild(noIndicationsMessageLi);
        }

    } else {
        if(loginAreaDiv) loginAreaDiv.style.display = 'block';
        if(userInfoDiv) userInfoDiv.style.display = 'none';
        if(logoutButton) logoutButton.style.display = 'none';
        if(authMessageP) authMessageP.style.display = 'block';

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
        userProfileData = null;
        userLinkedInVanityName = null;
    }
}

supabaseClient.auth.onAuthStateChange((event, session) => {
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

        const profileDataToSave = {
            id: currentUser.id,
            my_linkedin_vanity: userLinkedInVanityName, // Use the globally stored/updated vanity name
            current_salary: profileForm.elements.current_salary.value ? parseFloat(profileForm.elements.current_salary.value) : null,
            desired_salary: profileForm.elements.desired_salary.value ? parseFloat(profileForm.elements.desired_salary.value) : null,
            skills: profileForm.elements.skills.value.split(',').map(s => s.trim()).filter(s => s.length > 0),
            desired_role_type: profileForm.elements.desired_role_type.value.trim() || null,
            desired_companies: profileForm.elements.desired_companies.value.split(',').map(s => s.trim()).filter(s => s.length > 0),
            updated_at: new Date().toISOString(),
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
            userProfileData = data;
            alert('Perfil salvo com sucesso!');
            if (userProfileData && userProfileData.my_linkedin_vanity) {
                await fetchUserIndications(userProfileData.my_linkedin_vanity);
            }
        }
        submitProfileButton.disabled = false;
        submitProfileButton.textContent = originalButtonText;
    });
}

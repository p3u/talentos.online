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

const vanityInputSection = document.getElementById('vanityInputSection');
const vanityForm = document.getElementById('vanityForm');
const myLinkedInVanityInput = document.getElementById('my_linkedin_vanity');

const resultsSection = document.getElementById('resultsSection');
const referralsFoundCountSpan = document.getElementById('referralsFoundCount');
const foundAreasListUl = document.getElementById('foundAreasList');
const noResultsMessageLi = document.getElementById('noResultsMessage');
const navigationActions = document.getElementById('navigationActions');

let currentUser = null;

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
    // onAuthStateChange will handle UI update
}

// --- UI Update and Data Fetching ---
function updateUI(user) {
    currentUser = user;
    if (user) {
        const linkedInIdentityData = user.identities?.find(id => id.provider === 'linkedin' || id.provider === 'linkedin_oidc')?.identity_data;

        if (loginAreaDiv) loginAreaDiv.style.display = 'none';
        if (authMessageP) authMessageP.style.display = 'none'; // Hide initial message
        if (userInfoDiv) userInfoDiv.style.display = 'flex';
        if (logoutButton) logoutButton.style.display = 'inline-flex';
        if (userAvatarImg) userAvatarImg.src = linkedInIdentityData?.picture || user.user_metadata?.avatar_url || 'https://placehold.co/50x50/0077b5/FFFFFF?text=LI&font=poppins';
        if (userNameSpan) userNameSpan.textContent = linkedInIdentityData?.name || user.user_metadata?.full_name || user.email;

        if (vanityInputSection) vanityInputSection.style.display = 'block';
        if (navigationActions) navigationActions.style.display = 'block';
        // Results section remains hidden until a search is performed
        if (resultsSection) resultsSection.style.display = 'none';

    } else { // User is not logged in
        if (loginAreaDiv) loginAreaDiv.style.display = 'block';
        if (authMessageP) {
            authMessageP.textContent = 'Para continuar, por favor, faça login com sua conta do LinkedIn.';
            authMessageP.style.display = 'block';
        }
        if (userInfoDiv) userInfoDiv.style.display = 'none';
        if (logoutButton) logoutButton.style.display = 'none';

        if (vanityInputSection) vanityInputSection.style.display = 'none';
        if (resultsSection) resultsSection.style.display = 'none';
        if (navigationActions) navigationActions.style.display = 'none';
    }
}

async function fetchReferralsByVanityName(vanityName) {
    if (!vanityName) {
        alert("Por favor, insira seu LinkedIn Vanity Name.");
        return;
    }

    console.log(`Fetching referrals for LinkedIn Vanity Name: ${vanityName}`);
    if (resultsSection) resultsSection.style.display = 'block';
    if (referralsFoundCountSpan) referralsFoundCountSpan.textContent = 'Buscando...';
    if (foundAreasListUl) foundAreasListUl.innerHTML = '';
    if (noResultsMessageLi) noResultsMessageLi.style.display = 'none';


    const { data: referrals, error } = await supabaseClient
        .from('indicacoes')
        .select('areas_destaque')
        .eq('indicado_linkedin_vanity', vanityName);

    if (error) {
        console.error('Error fetching referrals:', error);
        if (referralsFoundCountSpan) referralsFoundCountSpan.textContent = 'Erro';
        if (noResultsMessageLi) {
            noResultsMessageLi.textContent = 'Erro ao buscar indicações.';
            noResultsMessageLi.style.display = 'list-item';
            if(foundAreasListUl) foundAreasListUl.appendChild(noResultsMessageLi);
        }
        return;
    }

    if (referrals && referrals.length > 0) {
        if (referralsFoundCountSpan) referralsFoundCountSpan.textContent = referrals.length;
        const allAreas = referrals.flatMap(ref => ref.areas_destaque || []);
        const uniqueAreas = [...new Set(allAreas.filter(area => area))];

        if (uniqueAreas.length > 0) {
            if (noResultsMessageLi) noResultsMessageLi.style.display = 'none';
            if (foundAreasListUl) foundAreasListUl.innerHTML = uniqueAreas.map(area => `<li>${area}</li>`).join('');
        } else {
            if (noResultsMessageLi) {
                noResultsMessageLi.textContent = 'Você foi indicado(a), mas sem áreas específicas mencionadas.';
                noResultsMessageLi.style.display = 'list-item';
                if(foundAreasListUl) foundAreasListUl.appendChild(noResultsMessageLi);
            }
        }
    } else {
        if (referralsFoundCountSpan) referralsFoundCountSpan.textContent = '0';
        if (noResultsMessageLi) {
            noResultsMessageLi.textContent = 'Nenhuma indicação encontrada para este LinkedIn Vanity Name.';
            noResultsMessageLi.style.display = 'list-item';
            if(foundAreasListUl) foundAreasListUl.appendChild(noResultsMessageLi);
        }
    }
}

// --- Event Listeners ---

// Listen for authentication state changes (e.g., after login, logout)
supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('Auth Event on View Referrals Page:', event, 'Session:', session);
    // This will handle updates if the state changes *while the user is on the page*
    // (e.g., token refreshed, user logs out from another tab)
    // The initial load is now handled by DOMContentLoaded + getSession.
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        updateUI(session ? session.user : null);
    } else if (event === 'SIGNED_OUT') {
        updateUI(null);
    }
    // INITIAL_SESSION is handled by the DOMContentLoaded listener now
});

if (loginButton) {
    loginButton.addEventListener('click', signInWithLinkedIn);
}

if (logoutButton) {
    logoutButton.addEventListener('click', signOut);
}

if (vanityForm) {
    vanityForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!currentUser) {
            alert("Você precisa estar logado para buscar suas indicações.");
            return;
        }
        const vanityName = myLinkedInVanityInput.value.trim();
        if (vanityName) {
            await fetchReferralsByVanityName(vanityName);

            // Optionally, save/update this vanity name to their user_profile
            const { data: profile, error: profileError } = await supabaseClient
                .from('user_profiles')
                .select('id, my_linkedin_vanity') // Select only necessary fields
                .eq('id', currentUser.id)
                .single();

            if (profile && profile.my_linkedin_vanity !== vanityName) {
                const { error: updateError } = await supabaseClient
                    .from('user_profiles')
                    .update({ my_linkedin_vanity: vanityName, updated_at: new Date().toISOString() })
                    .eq('id', currentUser.id);
                if (updateError) {
                    console.warn("Could not update vanity name in user_profiles:", updateError);
                } else {
                    console.log("Vanity name updated in user_profiles.");
                }
            } else if (!profile && profileError && profileError.code === 'PGRST116') {
                // Profile doesn't exist, create it with the vanity name
                 const linkedInIdentity = currentUser.identities?.find(id => id.provider === 'linkedin' || id.provider === 'linkedin_oidc');
                 const newProfileData = {
                    id: currentUser.id,
                    full_name: currentUser.user_metadata?.full_name || currentUser.email,
                    email: currentUser.email,
                    avatar_url: linkedInIdentity?.identity_data?.picture || currentUser.user_metadata?.avatar_url,
                    linkedin_user_id: linkedInIdentity?.id || null,
                    my_linkedin_vanity: vanityName // Save the entered vanity name
                };
                const { error: createError } = await supabaseClient
                    .from('user_profiles')
                    .insert(newProfileData);
                if (createError) {
                    console.warn("Could not create profile with vanity name:", createError);
                } else {
                     console.log("Profile created with vanity name.");
                }
            }
        } else {
            alert("Por favor, insira seu LinkedIn Vanity Name.");
        }
    });
}

// Initial check for session when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log("View Referrals Page: DOMContentLoaded - Checking session.");
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) {
        console.error("Error getting initial session on View Referrals page:", error);
    }
    console.log("View Referrals Page - Initial session from getSession():", session);
    updateUI(session ? session.user : null);
});

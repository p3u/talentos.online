// Ensure Supabase library is loaded from HTML before this script runs
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

// Supabase Credentials (replace with your actual credentials if different, but these were provided by you)
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
const authMessageP = document.getElementById('authMessage'); // Added for consistency

const profileSection = document.getElementById('profileSection');
const indicationsSection = document.getElementById('indicationsSection');
const actionsSection = document.getElementById('actionsSection');
const profileForm = document.getElementById('profileForm');

const indicationsCountSpan = document.getElementById('indicationsCount');
const indicatedAreasListUl = document.getElementById('indicatedAreasList');
const noIndicationsMessageLi = document.getElementById('noIndicationsMessage');

let currentUser = null;

// --- Authentication Functions ---
async function signInWithLinkedIn() {
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'linkedin_oidc', // Corrected provider name
        options: {
            redirectTo: window.location.href, // Redirects back to the current page
            // UPDATED SCOPES: Removed r_liteprofile as it's likely causing the unauthorized_scope_error
            // OIDC 'profile' scope should provide name, picture, etc.
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
    // UI update will be handled by onAuthStateChange
}

// --- Data Fetching and Profile Management Functions ---
async function fetchUserIndications(user) {
    if (!user || !user.user_metadata?.full_name) {
        if(indicationsCountSpan) indicationsCountSpan.textContent = '0';
        if (noIndicationsMessageLi) {
            noIndicationsMessageLi.textContent = 'Não foi possível verificar seu nome para buscar indicações.';
            noIndicationsMessageLi.style.display = 'list-item';
        }
        if(indicatedAreasListUl) indicatedAreasListUl.innerHTML = ''; // Clear previous list
        if (noIndicationsMessageLi && indicatedAreasListUl) indicatedAreasListUl.appendChild(noIndicationsMessageLi);
        return;
    }

    const userNameFromLinkedIn = user.user_metadata.full_name;
    console.log(`Fetching indications for: ${userNameFromLinkedIn}`);

    const { data: indications, error: indicationsError } = await supabaseClient
        .from('indicacoes') // Your referrals table
        .select('areas_destaque, linkedin_indicado')
        .ilike('nome_indicado', `%${userNameFromLinkedIn}%`);

    if (indicationsError) {
        console.error('Error fetching indications:', indicationsError);
        if(indicationsCountSpan) indicationsCountSpan.textContent = 'Erro';
        if (noIndicationsMessageLi) noIndicationsMessageLi.textContent = 'Não foi possível carregar as áreas indicadas.';
    } else if (indications && indications.length > 0) {
        if(indicationsCountSpan) indicationsCountSpan.textContent = indications.length;
        const allAreas = indications.flatMap(ind => ind.areas_destaque || []);
        const uniqueAreas = [...new Set(allAreas.filter(area => area))];

        if (uniqueAreas.length > 0) {
            if (noIndicationsMessageLi) noIndicationsMessageLi.style.display = 'none';
            if(indicatedAreasListUl) indicatedAreasListUl.innerHTML = uniqueAreas.map(area => `<li>${area}</li>`).join('');
        } else {
            if (noIndicationsMessageLi) {
                noIndicationsMessageLi.textContent = 'Você foi indicado(a), mas sem áreas específicas mencionadas.';
                noIndicationsMessageLi.style.display = 'list-item';
            }
            if(indicatedAreasListUl) indicatedAreasListUl.innerHTML = '';
            if (noIndicationsMessageLi && indicatedAreasListUl) indicatedAreasListUl.appendChild(noIndicationsMessageLi);
        }
    } else {
        if(indicationsCountSpan) indicationsCountSpan.textContent = '0';
        if (noIndicationsMessageLi) {
            noIndicationsMessageLi.textContent = 'Nenhuma indicação encontrada para seu nome no momento.';
            noIndicationsMessageLi.style.display = 'list-item';
        }
        if(indicatedAreasListUl) indicatedAreasListUl.innerHTML = '';
        if (noIndicationsMessageLi && indicatedAreasListUl) indicatedAreasListUl.appendChild(noIndicationsMessageLi);
    }
}

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
        populateProfileForm(profile);
        return profile;
    } else {
        console.log("No existing profile, creating a new one for user:", user.id);
        const linkedInIdentity = user.identities?.find(id => id.provider === 'linkedin' || id.provider === 'linkedin_oidc');
        const newProfileData = {
            id: user.id,
            full_name: user.user_metadata?.full_name || user.email,
            email: user.email,
            avatar_url: user.user_metadata?.avatar_url,
            linkedin_user_id: linkedInIdentity?.id || null
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
        populateProfileForm(createdProfile);
        return createdProfile;
    }
}

function populateProfileForm(profile) {
    if (!profile || !profileForm) return;
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

        if(profileSection) profileSection.style.display = 'block';
        if(indicationsSection) indicationsSection.style.display = 'block';
        if(actionsSection) actionsSection.style.display = 'block';

        await loadOrCreateUserProfile(user);
        await fetchUserIndications(user);

    } else {
        if(loginAreaDiv) loginAreaDiv.style.display = 'block';
        if(userInfoDiv) userInfoDiv.style.display = 'none';
        if(logoutButton) logoutButton.style.display = 'none';
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
    }
}

supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('Auth Event:', event, 'Session:', session);
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
            alert('Perfil salvo com sucesso!');
        }
        submitProfileButton.disabled = false;
        submitProfileButton.textContent = originalButtonText;
    });
}

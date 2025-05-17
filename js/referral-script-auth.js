// Supabase Credentials
const SUPABASE_URL = 'https://kyeyxkzvvxcypyjsfuzu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5ZXl4a3p2dnhjeXB5anNmdXp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxNDczNzAsImV4cCI6MjA2MjcyMzM3MH0.H3ZS35V1vxU9TLRAzi10kOiFdZcZtKlAX9bJ0DVKrAc';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements for Auth
const loginButton = document.getElementById('loginButton');
const logoutButton = document.getElementById('logoutButton');
const authStatusDiv = document.getElementById('authStatus');
const userNameSpan = document.getElementById('userName');
const userAvatarImg = document.getElementById('userAvatar');
const referralContainer = document.getElementById('referralContainer'); // The main form container

// DOM Elements for Referral Form
const form = document.getElementById('referralForm');
const thankYouMessage = document.getElementById('thankYouMessage');
const newReferralButton = document.getElementById('newReferralButton');
// Ensure submitButton is correctly selected, assuming it's the first/only submit type button in the form
const submitButton = form ? form.querySelector('button[type="submit"]') : null;
const openLinkedInSearchBtn = document.getElementById('openLinkedInSearchButton');

let currentUser = null; // To store the logged-in user object

// --- Authentication Logic ---
async function signInWithLinkedIn() {
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'linkedin_oidc', // Ensure this matches your Supabase provider config
        options: {
            redirectTo: window.location.href,
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
}

// Update UI based on auth state
function updateAuthUI(user) {
    currentUser = user;
    if (user) {
        if (authStatusDiv) authStatusDiv.style.display = 'flex';
        if (userNameSpan) userNameSpan.textContent = `Indicando como: ${user.user_metadata?.full_name || user.email}`;
        if (userAvatarImg) userAvatarImg.src = user.user_metadata?.avatar_url || 'https://placehold.co/30x30/0077b5/FFFFFF?text=LI&font=poppins';
        if (loginButton) loginButton.style.display = 'none';
        if (logoutButton) logoutButton.style.display = 'inline-flex';
        if (referralContainer) referralContainer.style.display = 'block'; // Show form
        if (thankYouMessage) thankYouMessage.style.display = 'none'; // Ensure thank you message is hidden initially
    } else {
        if (authStatusDiv) authStatusDiv.style.display = 'none';
        if (loginButton) loginButton.style.display = 'inline-flex'; // Show login button
        if (logoutButton) logoutButton.style.display = 'none';
        if (referralContainer) referralContainer.style.display = 'none'; // Hide form
        if (thankYouMessage) thankYouMessage.style.display = 'none';
    }
}

// Listen for auth state changes
supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('Auth Event on Referral Page:', event, session);
    updateAuthUI(session ? session.user : null);
});

// Attach event listeners for login/logout
if (loginButton) {
    loginButton.addEventListener('click', signInWithLinkedIn);
}
if (logoutButton) {
    logoutButton.addEventListener('click', signOut);
}

// --- Referral Form Logic ---
function openLinkedInSearchForProfile() {
    const name = document.getElementById('indicatedName').value.trim();
    const company = document.getElementById('indicatedCompany').value.trim();
    if (name === "") {
        alert("Por favor, preencha pelo menos o nome do indicado para a busca.");
        document.getElementById('indicatedName').focus();
        return;
    }
    let keywords = name;
    if (company !== "") keywords += ` ${company}`;
    const linkedInSearchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}&origin=GLOBAL_SEARCH_HEADER`;
    window.open(linkedInSearchUrl, '_blank');
}

if (openLinkedInSearchBtn) {
    openLinkedInSearchBtn.addEventListener('click', openLinkedInSearchForProfile);
}

const tooltipTrigger = document.getElementById('tooltipTrigger');
const tooltipContent = document.getElementById('linkedinHelp');
if (tooltipTrigger && tooltipContent) {
    tooltipTrigger.addEventListener('click', (event) => {
        event.stopPropagation();
        tooltipContent.classList.toggle('visible');
    });
    tooltipTrigger.addEventListener('mouseover', () => tooltipContent.classList.add('visible'));
    tooltipTrigger.addEventListener('mouseleave', () => tooltipContent.classList.remove('visible'));
}
document.addEventListener('click', (event) => {
    if (tooltipTrigger && tooltipContent &&
        typeof tooltipTrigger.contains === 'function' && typeof tooltipContent.contains === 'function' &&
        !tooltipTrigger.contains(event.target) && !tooltipContent.contains(event.target)) {
        tooltipContent.classList.remove('visible');
    }
});

const checkboxesAreas = document.querySelectorAll('input[name="areas"]');
const maxAreas = 2;
checkboxesAreas.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        if (document.querySelectorAll('input[name="areas"]:checked').length > maxAreas) {
            checkbox.checked = false;
            alert(`Você pode selecionar no máximo ${maxAreas} áreas.`);
        }
    });
});

const outraAreaChk = document.getElementById('outraAreaChk');
const outraAreaInputContainer = document.getElementById('outraAreaInputContainer');
const outraAreaText = document.getElementById('outraAreaText');
if (outraAreaChk && outraAreaInputContainer && outraAreaText) {
    outraAreaChk.addEventListener('change', () => {
        outraAreaInputContainer.style.display = outraAreaChk.checked ? 'block' : 'none';
        outraAreaText.required = outraAreaChk.checked;
        if (!outraAreaChk.checked) outraAreaText.value = '';
    });
}

if (form && thankYouMessage && newReferralButton && submitButton) {
    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        if (!currentUser) {
            alert("Por favor, faça login com o LinkedIn antes de enviar uma indicação.");
            if(loginButton) loginButton.focus(); // Focus on login button if not logged in
            return;
        }

        const originalButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = 'Enviando... <span class="spinner"></span>';

        const nomeIndicado = document.getElementById('indicatedName').value.trim();
        const empresaIndicado = document.getElementById('indicatedCompany').value.trim();
        const linkedinIndicado = document.getElementById('indicatedContact').value.trim();
        const relacaoProfissional = document.getElementById('relationship').value;

        const areasSelecionadas = [];
        document.querySelectorAll('input[name="areas"]:checked').forEach(checkbox => {
            if (checkbox.value === 'outra_area_chk' && outraAreaChk.checked) {
                const outraAreaVal = outraAreaText.value.trim();
                if (outraAreaVal) areasSelecionadas.push(outraAreaVal);
            } else if (checkbox.value !== 'outra_area_chk') {
                areasSelecionadas.push(checkbox.value);
            }
        });

        // Get LinkedIn provider-specific ID for the referrer
        const linkedInIdentity = currentUser.identities?.find(id => id.provider === 'linkedin' || id.provider === 'linkedin_oidc');

        const indicacaoData = {
            nome_indicado: nomeIndicado,
            empresa_indicado: empresaIndicado || null,
            linkedin_indicado: linkedinIndicado,
            relacao_profissional: relacaoProfissional,
            areas_destaque: areasSelecionadas.length > 0 ? areasSelecionadas : null,
            // Referrer's information
            indicador_auth_user_id: currentUser.id, // Crucial for RLS
            indicador_nome: currentUser.user_metadata?.full_name || currentUser.email,
            indicador_linkedin_id: linkedInIdentity?.id || null
        };

        console.log("Submitting referral data:", indicacaoData); // Log data being sent

        try {
            const { data, error } = await supabaseClient
                .from('indicacoes')
                .insert([indicacaoData]);

            if (error) {
                console.error('Erro ao salvar indicação:', error);
                alert(`Houve um erro ao enviar sua indicação: ${error.message}. Por favor, tente novamente.`);
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
                return;
            }

            form.reset();
            if(referralContainer) referralContainer.style.display = 'none'; // Hide form container
            if (thankYouMessage) {
                 thankYouMessage.style.display = 'block';
                 thankYouMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            // Keep auth status visible
            if (authStatusDiv) authStatusDiv.style.display = 'flex';


        } catch (error) {
            console.error('Erro inesperado na submissão:', error);
            alert('Houve um erro inesperado ao processar sua indicação. Por favor, tente novamente.');
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    });

    if (newReferralButton) {
        newReferralButton.addEventListener('click', function() {
            if (thankYouMessage) thankYouMessage.style.display = 'none';
            if (referralContainer) referralContainer.style.display = 'block'; // Show form container
            if (form) form.style.display = 'block'; // Ensure form itself is visible
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = '<span class="emoji">🚀</span> Enviar Indicação Agora';
            }
            const indicatedNameField = document.getElementById('indicatedName');
            if (indicatedNameField) indicatedNameField.focus();
        });
    }
} else {
    if (!form) console.error("Elemento do formulário (referralForm) não encontrado.");
    if (!thankYouMessage) console.error("Elemento da mensagem de agradecimento (thankYouMessage) não encontrado.");
    if (!newReferralButton) console.error("Elemento do botão de nova indicação (newReferralButton) não encontrado.");
    if (form && !submitButton) console.error("Botão de submit dentro do formulário não encontrado.");
}

// Initial UI check based on current session (onAuthStateChange handles this well)
// (async () => {
//     const { data: { session } } = await supabaseClient.auth.getSession();
//     updateAuthUI(session ? session.user : null);
// })();

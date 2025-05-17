// Configuração do Cliente Supabase com suas chaves reais
// Certifique-se de que a biblioteca Supabase já foi carregada no HTML antes deste script.
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
const SUPABASE_URL = 'https://kyeyxkzvvxcypyjsfuzu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5ZXl4a3p2dnhjeXB5anNmdXp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxNDczNzAsImV4cCI6MjA2MjcyMzM3MH0.H3ZS35V1vxU9TLRAzi10kOiFdZcZtKlAX9bJ0DVKrAc';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos do DOM
const form = document.getElementById('referralForm');
const thankYouMessage = document.getElementById('thankYouMessage');
const newReferralButton = document.getElementById('newReferralButton');
const submitButton = form.querySelector('button[type="submit"]'); // Pega o botão de submit original
const openLinkedInSearchBtn = document.getElementById('openLinkedInSearchButton');


// Função para Busca Assistida no LinkedIn
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

// Adiciona listener ao botão de busca do LinkedIn
if (openLinkedInSearchBtn) {
    openLinkedInSearchBtn.addEventListener('click', openLinkedInSearchForProfile);
}

// Tooltip Logic
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

// Limitar seleção de checkboxes
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

// Mostrar campo "Outra área"
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

// Envio do Formulário
if (form && thankYouMessage && newReferralButton && submitButton) {
    form.addEventListener('submit', async function(event) {
        event.preventDefault();

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

        // Objeto de dados para o Supabase
        // IMPORTANTE: As chaves (ex: nome_indicado) DEVEM CORRESPONDER
        // aos nomes das colunas na sua tabela 'indicacoes' no Supabase.
        const indicacaoData = {
            nome_indicado: nomeIndicado,
            empresa_indicado: empresaIndicado || null,
            linkedin_indicado: linkedinIndicado,
            relacao_profissional: relacaoProfissional,
            areas_destaque: areasSelecionadas.length > 0 ? areasSelecionadas : null
        };

        try {
            const { data, error } = await supabaseClient
                .from('indicacoes') // Nome da sua tabela no Supabase
                .insert([indicacaoData]);

            if (error) {
                console.error('Erro ao salvar indicação:', error);
                alert(`Houve um erro ao enviar sua indicação: ${error.message}. Por favor, tente novamente.`);
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
                return;
            }

            form.reset();
            form.style.display = 'none';
            thankYouMessage.style.display = 'block';
            thankYouMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Manter o botão de submit original desabilitado aqui, pois o formulário está escondido
            // ou reabilitar se for necessário para o fluxo do botão "nova indicação"
        } catch (error) {
            console.error('Erro inesperado na submissão:', error);
            alert('Houve um erro inesperado ao processar sua indicação. Por favor, tente novamente.');
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    });

    newReferralButton.addEventListener('click', function() {
        thankYouMessage.style.display = 'none';
        form.style.display = 'block';
        submitButton.disabled = false; // Reabilita o botão de submit principal
        submitButton.innerHTML = '<span class="emoji">🚀</span> Enviar Indicação Agora';
        document.getElementById('indicatedName').focus();
    });
} else {
    // Log para ajudar a diagnosticar se algum elemento principal não for encontrado
    if (!form) console.error("Elemento do formulário (referralForm) não encontrado.");
    if (!thankYouMessage) console.error("Elemento da mensagem de agradecimento (thankYouMessage) não encontrado.");
    if (!newReferralButton) console.error("Elemento do botão de nova indicação (newReferralButton) não encontrado.");
    if (form && !submitButton) console.error("Botão de submit dentro do formulário não encontrado.");
}

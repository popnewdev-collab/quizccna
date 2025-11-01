// === Variáveis de Estado ===
let allQuestions = [];
let current = null;
let answeredQuestions = new Set();
let asked = 0, correctCount = 0, wrongCount = 0;
let timer = null;
let timeLeft = 0;

// === Funções Auxiliares ===
function escapeHTML(str = '') {
    return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function formatTime(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
}

function arraysEqual(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

function showCorrectMessage() {
    const div = document.createElement('div');
    div.className = 'correct-message';
    div.textContent = 'Acertou!';
    div.setAttribute('aria-live', 'assertive');
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 1000);
}

// === Carregamento (aba: subnets) ===
async function loadSheet() {
    try {
        const url = `${Config.SHEET_API_URL}?sheet=subnets`;
        const res = await fetch(url);
        
        if (!res.ok) {
            throw new Error(`Falha na rede: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();

        // Verifica erro do Apps Script
        if (data && typeof data === 'object' && data.error) {
            throw new Error(data.error);
        }

        // Verifica se é array
        if (!Array.isArray(data)) {
            throw new Error('Resposta inválida: dados não são uma lista de perguntas.');
        }

        if (data.length === 0) {
            document.getElementById('qMeta').textContent = 'Aba "subnets" está vazia.';
            return;
        }

        allQuestions = data.map((r, i) => ({
            id: String(i + 1),
            question: (r.question || '').toString().trim(),
            options: { 
                A: (r.A || '').toString().trim(), 
                B: (r.B || '').toString().trim(), 
                C: (r.C || '').toString().trim(), 
                D: (r.D || '').toString().trim() 
            },
            correct: (r.correct || '').toString().replace(/\s/g, '').split(',').filter(Boolean).map(s => s.toUpperCase()),
            explanation: (r.explanation || '').toString().trim(),
            image: (r.image || '').toString().trim(),
            category: (r.category || 'Geral').toString().trim()
        })).filter(q => q.question && Object.values(q.options).some(opt => opt.trim() !== ''));

        // Preenche seletor de categoria
        const sel = document.getElementById('categorySelect');
        sel.innerHTML = '<option value="all">Todas</option>';
        [...new Set(allQuestions.map(q => q.category))].sort().forEach(cat => {
            sel.innerHTML += `<option value="${cat}">${cat}</option>`;
        });

        if (allQuestions.length === 0) {
            document.getElementById('qMeta').textContent = 'Nenhuma pergunta válida na aba "subnets".';
            return;
        }

        updateStats();
        nextQuestion();
        startTimer();

    } catch (err) {
        console.error('Erro ao carregar perguntas:', err);
        const qMeta = document.getElementById('qMeta');
        qMeta.textContent = `Erro: ${err.message}`;
        qMeta.style.color = 'var(--danger)';
    }
}

// === Renderização da Pergunta (SEM FOCO AUTOMÁTICO) ===
function renderQuestion(q) {
    if (!q) return;

    current = q;
    document.getElementById('qMeta').textContent = `ID ${q.id} — ${escapeHTML(q.category)}`;
    document.getElementById('questionText').textContent = q.question;

    const opts = document.getElementById('options');
    const expl = document.getElementById('explanation');
    const nextBtn = document.getElementById('nextBtn');

    // Limpa tudo
    opts.innerHTML = '';
    expl.style.display = 'none';
    expl.innerHTML = = '';
    nextBtn.disabled = false;

    // Remove qualquer foco ou seleção anterior
    document.activeElement?.blur();
    document.querySelectorAll('.opt').forEach(opt => {
        opt.setAttribute('aria-pressed', 'false');
        opt.classList.remove('selected', 'correct', 'wrong', 'opt-disabled');
        opt.onclick = null;
    });

    // Cria alternativas
    ['A', 'B', 'C', 'D'].forEach(l => {
        const txt = q.options[l];
        if (!txt) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'opt';
        btn.dataset.letter = l;
        btn.setAttribute('aria-pressed', 'false');
        btn.innerHTML = `<span class="letter">${l}</span><span class="text">${escapeHTML(txt)}</span>`;
        btn.onclick = () => validateAnswer([l]);
        btn.onkeydown = e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                btn.click();
            }
        };
        opts.appendChild(btn);
    });

    // Remove qualquer foco indesejado
    document.activeElement?.blur();
}

// === Validação da Resposta ===
function validateAnswer(selected) {
    const opts = document.querySelectorAll('.opt');
    const expl = document.getElementById('explanation');
    const nextBtn = document.getElementById('nextBtn');

    // Desabilita cliques
    opts.forEach(o => {
        o.classList.add('opt-disabled');
        o.onclick = null;
    });

    const isCorrect = arraysEqual(selected, current.correct);
    asked++;
    if (isCorrect) correctCount++; else wrongCount++;
    updateStats();

    // Marca visual
    opts.forEach(o => {
        const l = o.dataset.letter;
        if (current.correct.includes(l)) o.classList.add('correct');
        if (selected.includes(l) && !current.correct.includes(l)) o.classList.add('wrong');
    });

    // Limpa explicação
    expl.style.display = 'none';
    expl.innerHTML = '';

    if (isCorrect) {
        // ACERTOU → sem explicação
        showCorrectMessage();
        nextBtn.disabled = true;
        setTimeout(nextQuestion, 1200);
    } else {
        // ERROU → mostra explicação
        expl.style.display = 'block';
        if (current.image) {
            expl.innerHTML = `<img src="${escapeHTML(current.image)}" alt="Explicação" style="max-width:100%; border-radius:0.5rem; margin:0.5rem 0;">`;
            if (current.explanation) {
                expl.innerHTML += `<p style="margin-top:0.5rem;">${escapeHTML(current.explanation)}</p>`;
            }
        } else {
            expl.innerHTML = `<p>${escapeHTML(current.explanation || 'Sem explicação disponível.')}</p>`;
        }
    }
}

// === Próxima Pergunta ===
function nextQuestion() {
    const cat = document.getElementById('categorySelect').value;
    let pool = allQuestions.filter(q => cat === 'all' || q.category === cat);
    pool = pool.filter(q => !answeredQuestions.has(q.id));

    if (pool.length === 0) {
        answeredQuestions.clear();
        pool = allQuestions.filter(q => cat === 'all' || q.category === cat);
    }

    const q = pool[Math.floor(Math.random() * pool.length)];
    answeredQuestions.add(q.id);
    renderQuestion(q);
}

// === Timer (contagem crescente) ===
function startTimer() {
    stopTimer();
    timeLeft = 0;
    timer = setInterval(() => {
        timeLeft++;
        document.getElementById('timerDisplay').textContent = formatTime(timeLeft);
    }, 1000);
}

function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
}

// === Estatísticas ===
function updateStats() {
    document.getElementById('totalAsked').textContent = asked;
    document.getElementById('totalCorrect').textContent = correctCount;
    document.getElementById('totalWrong').textContent = wrongCount;
    const pct = asked ? Math.round((correctCount / asked) * 100) : 0;
    document.getElementById('progress').textContent = `${pct}%`;
}

// === Eventos ===
document.getElementById('restartBtn').onclick = () => {
    answeredQuestions.clear();
    asked = correctCount = wrongCount = 0;
    updateStats();
    nextQuestion();
};

document.getElementById('categorySelect').onchange = () => {
    answeredQuestions.clear();
    nextQuestion();
};

document.getElementById('nextBtn').onclick = () => {
    if (!document.getElementById('nextBtn').disabled) {
        nextQuestion();
    }
};

// === Inicialização ===
loadSheet();

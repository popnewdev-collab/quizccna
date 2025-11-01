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

function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function formatTime(s) {
    if (s < 0) s = 0;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
}

function arraysEqual(a, b) {
    return a.length === b.length && a.every((val, index) => val === b[index]);
}

function showError(message) {
    const div = Object.assign(document.createElement('div'), {
        className: 'error-message',
        textContent: message
    });
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 5000);
}

function showCorrectMessage() {
    const div = Object.assign(document.createElement('div'), {
        className: 'correct-message',
        textContent: 'Acertou!',
        ariaLive: 'assertive'
    });
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 1000);
}

// === Carregamento de Dados (aba: subnets) ===
async function loadSheet() {
    try {
        if (!Config?.SHEET_API_URL) throw new Error('Configuração da API não encontrada.');

        const res = await fetch(Config.SHEET_API_URL + '?sheet=subnets');
        if (!res.ok) throw new Error(`Falha na API: ${res.status}`);
        const data = await res.json();

        allQuestions = data.map((r, idx) => ({
            id: String(idx + 1),
            question: (r.question || '').toString().trim(),
            options: {
                A: (r.A || '').toString().trim(),
                B: (r.B || '').toString().trim(),
                C: (r.C || '').toString().trim(),
                D: (r.D || '').toString().trim()
            },
            correct: (r.correct || '').toString().replace(/\s+/g,'').split(',').filter(Boolean).map(s => s.toUpperCase()),
            explanation: (r.explanation || '').toString().trim(),
            image: (r.image || '').toString().trim(),
            category: (r.category || 'Geral').toString().trim()
        })).filter(q => q.question && Object.values(q.options).some(opt => opt));

        // Preenche seletor de categoria
        const sel = document.getElementById('categorySelect');
        sel.querySelectorAll('option:not([value="all"])').forEach(o => o.remove());
        const cats = [...new Set(allQuestions.map(q => q.category))].sort();
        cats.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            sel.appendChild(opt);
        });

        if (allQuestions.length === 0) {
            document.getElementById('qMeta').textContent = 'Nenhuma pergunta encontrada na aba "subnets".';
            return;
        }

        updateStats();
        nextQuestion();
        startTimer(0); // Timer infinito no quiz
    } catch (err) {
        console.error(err);
        document.getElementById('qMeta').textContent = `Erro: ${err.message}`;
    }
}

// === Renderização ===
function renderQuestion(q) {
    if (!q) return;

    current = q;
    document.getElementById('qMeta').textContent = `ID ${q.id} — ${escapeHTML(q.category)}`;
    document.getElementById('questionText').textContent = q.question;

    const opts = document.getElementById('options');
    const expl = document.getElementById('explanation');
    opts.innerHTML = '';
    expl.style.display = 'none';
    expl.innerHTML = '';

    ['A', 'B', 'C', 'D'].forEach(letter => {
        const txt = q.options[letter];
        if (!txt) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'opt';
        btn.dataset.letter = letter;
        btn.setAttribute('aria-pressed', 'false');
        btn.innerHTML = `<span class="letter">${letter}</span><span class="text">${escapeHTML(txt)}</span>`;
        btn.onclick = () => validateAnswer([letter]);
        btn.onkeydown = e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), btn.click());
        opts.appendChild(btn);
    });

    focusFirstOption();
}

// === Validação e Explicação ===
function validateAnswer(selected) {
    document.querySelectorAll('.opt').forEach(o => {
        o.classList.add('opt-disabled');
        o.onclick = null;
    });

    const isCorrect = arraysEqual(selected, current.correct);
    asked++;
    if (isCorrect) correctCount++; else wrongCount++;
    updateStats();

    // Marca visual
    document.querySelectorAll('.opt').forEach(o => {
        const l = o.dataset.letter;
        if (current.correct.includes(l)) o.classList.add('correct');
        if (selected.includes(l) && !current.correct.includes(l)) o.classList.add('wrong');
    });

    const expl = document.getElementById('explanation');
    expl.style.display = 'block';

    if (current.image) {
        expl.innerHTML = `<img src="${escapeHTML(current.image)}" alt="Explicação" style="max-width:100%; border-radius:0.5rem; margin:0.5rem 0;">`;
        if (current.explanation) expl.innerHTML += `<p style="margin-top:0.5rem;">${escapeHTML(current.explanation)}</p>`;
    } else {
        expl.innerHTML = `<p>${escapeHTML(current.explanation || 'Sem explicação.')}</p>`;
    }

    if (isCorrect) {
        showCorrectMessage();
        setTimeout(nextQuestion, 1200);
    }
}

// === Navegação ===
function nextQuestion() {
    const cat = document.getElementById('categorySelect').value;
    let pool = cat === 'all' ? allQuestions : allQuestions.filter(q => q.category === cat);
    pool = pool.filter(q => !answeredQuestions.has(q.id));

    if (pool.length === 0) {
        answeredQuestions.clear();
        pool = cat === 'all' ? allQuestions : allQuestions.filter(q => q.category === cat);
    }

    const q = pool[Math.floor(Math.random() * pool.length)];
    answeredQuestions.add(q.id);
    renderQuestion(q);
}

// === Timer (infinito) ===
function startTimer(seconds) {
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

document.getElementById('nextBtn').onclick = nextQuestion;

// === Inicialização ===
loadSheet();

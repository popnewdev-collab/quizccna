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
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        allQuestions = data.map((r, i) => ({
            id: String(i + 1),
            question: (r.question || '').trim(),
            options: { A: (r.A || ''), B: (r.B || ''), C: (r.C || ''), D: (r.D || '') },
            correct: (r.correct || '').replace(/\s/g, '').split(',').filter(Boolean).map(s => s.toUpperCase()),
            explanation: (r.explanation || '').trim(),
            image: (r.image || '').trim(),
            category: (r.category || 'Geral').trim()
        })).filter(q => q.question && Object.values(q.options).some(Boolean));

        // Preenche categorias
        const sel = document.getElementById('categorySelect');
        sel.innerHTML = '<option value="all">Todas</option>';
        [...new Set(allQuestions.map(q => q.category))].sort().forEach(cat => {
            sel.innerHTML += `<option value="${cat}">${cat}</option>`;
        });

        if (allQuestions.length === 0) {
            document.getElementById('qMeta').textContent = 'Nenhuma pergunta na aba "subnets".';
            return;
        }

        updateStats();
        nextQuestion();
        startTimer();
    } catch (err) {
        document.getElementById('qMeta').textContent = `Erro: ${err.message}`;
        console.error(err);
    }
}

// === Renderização ===
function renderQuestion(q) {
    current = q;
    document.getElementById('qMeta').textContent = `ID ${q.id} — ${escapeHTML(q.category)}`;
    document.getElementById('questionText').textContent = q.question;

    const opts = document.getElementById('options');
    const expl = document.getElementById('explanation');
    opts.innerHTML = '';
    expl.style.display = 'none';

    ['A', 'B', 'C', 'D'].forEach(l => {
        const txt = q.options[l];
        if (!txt) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'opt';
        btn.dataset.letter = l;
        btn.innerHTML = `<span class="letter">${l}</span><span class="text">${escapeHTML(txt)}</span>`;
        btn.onclick = () => validateAnswer([l]);
        opts.appendChild(btn);
    });
}

// === Validação ===
function validateAnswer(selected) {
    document.querySelectorAll('.opt').forEach(o => o.classList.add('opt-disabled'));

    const isCorrect = arraysEqual(selected, current.correct);
    asked++;
    if (isCorrect) correctCount++; else wrongCount++;
    updateStats();

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

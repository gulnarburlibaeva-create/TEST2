(function () {
  "use strict";

  const TOTAL_PICK = 30;
  const TIME_LIMIT_SEC = 40 * 60;
  const PASS_PERCENT = 50;

  const SPECIALTIES = [
    {
      value: "software_support",
      labelKk: "Бағдарламалық қамтамасыз етуді сүйемелдеу",
      labelRu: "Сопровождение ПО",
    },
    { value: "informatics", labelKk: "Информатика", labelRu: "Информатика" },
    { value: "math", labelKk: "Математика", labelRu: "Математика" },
    { value: "physics", labelKk: "Физика", labelRu: "Физика" },
    { value: "economics", labelKk: "Экономика", labelRu: "Экономика" },
  ];

  const GROUPS = [
    { value: "0613-24-9б 1", labelKk: "0613-24-9б 1", labelRu: "0613-24-9б 1" },
    { value: "0613-249б 2", labelKk: "0613-249б 2", labelRu: "0613-249б 2" },
  ];

  const TEACHER_EMAIL = "Gulnar_18_93@mail.ru";
  const FORMSUBMIT_ACTION = "https://formsubmit.co/Gulnar_18_93@mail.ru";
  const RESULTS_STORAGE_KEY = "student_test_results_v1";

  /** @type {{ id: number, question: string, options: string[], correct: number }[]} */
  let questionBank = [];
  /** @type {typeof questionBank} */
  let sessionQuestions = [];
  const answers = [];

  let student = { name: "", specialty: "", group: "" };
  let currentIndex = 0;
  let selectedOption = null;
  let remainingSec = TIME_LIMIT_SEC;
  let timerId = null;
  let testEnded = false;

  const el = {
    screenStart: document.getElementById("screen-start"),
    screenTest: document.getElementById("screen-test"),
    screenResults: document.getElementById("screen-results"),
    formStart: document.getElementById("form-start"),
    inputName: document.getElementById("input-name"),
    selectSpecialty: document.getElementById("select-specialty"),
    selectGroup: document.getElementById("select-group"),
    fieldName: document.getElementById("field-name"),
    fieldSpecialty: document.getElementById("field-specialty"),
    fieldGroup: document.getElementById("field-group"),
    testAvatar: document.getElementById("test-avatar"),
    testStudentName: document.getElementById("test-student-name"),
    testStudentMeta: document.getElementById("test-student-meta"),
    timerDisplay: document.getElementById("timer-display"),
    timerText: document.getElementById("timer-text"),
    progressLabel: document.getElementById("progress-label"),
    progressPct: document.getElementById("progress-pct"),
    progressFill: document.getElementById("progress-fill"),
    questionText: document.getElementById("question-text"),
    optionsList: document.getElementById("options-list"),
    btnNext: document.getElementById("btn-next"),
    btnNextKk: document.getElementById("btn-next-kk"),
    btnNextRu: document.getElementById("btn-next-ru"),
    resultScorePct: document.getElementById("result-score-pct"),
    resultPassLabel: document.getElementById("result-pass-label"),
    statCorrect: document.getElementById("stat-correct"),
    statWrong: document.getElementById("stat-wrong"),
    statTotal: document.getElementById("stat-total"),
    statTime: document.getElementById("stat-time"),
    resultAvatar: document.getElementById("result-avatar"),
    resultName: document.getElementById("result-name"),
    resultMeta: document.getElementById("result-meta"),
    resultDate: document.getElementById("result-date"),
    resultClock: document.getElementById("result-clock"),
    btnHome: document.getElementById("btn-home"),
    btnStart: document.getElementById("btn-start"),
    bankError: document.getElementById("bank-error"),
    teacherHistory: document.getElementById("teacher-history"),
    btnExportCsv: document.getElementById("btn-export-csv"),
    resultEmailNotice: document.getElementById("result-email-notice"),
  };

  function initials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function specialtyLine(s) {
    return s.labelKk + " / " + s.labelRu;
  }

  function specialtyLabel(value) {
    const s = SPECIALTIES.find((x) => x.value === value);
    return s ? specialtyLine(s) : value;
  }

  function loadResultsHistory() {
    try {
      const raw = localStorage.getItem(RESULTS_STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveResultsHistory(list) {
    try {
      localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn("localStorage толық:", e);
    }
  }

  function appendResultRecord(record) {
    const list = loadResultsHistory();
    list.push(record);
    saveResultsHistory(list);
    renderTeacherHistory();
  }

  function formatResultPlainText(record) {
    const lines = [];
    lines.push("=== ТЕСТ НӘТИЖЕСІ / РЕЗУЛЬТАТ ТЕСТА ===");
    lines.push("Уақыт / Время: " + record.submittedAt);
    lines.push("Студент / ФИО: " + record.studentName);
    lines.push("Топ / Группа: " + record.group);
    lines.push("Мамандық / Специальность: " + record.specialtyLabel);
    lines.push("Дұрыс / Верно: " + record.correctCount + " | Қате / Неверно: " + record.wrongCount);
    lines.push("Пайыз / %: " + record.scorePercent + " | Өту / Зачёт: " + (record.passed ? "иә / да" : "жоқ / нет"));
    lines.push("Уақыт (тест) / Время (тест): " + record.timeSpentFormatted);
    lines.push("");
    lines.push("--- Сұрақтар / Вопросы ---");
    record.details.forEach(function (d, idx) {
      lines.push("");
      lines.push("№" + (idx + 1) + " [id:" + d.questionId + "] " + (d.isCorrect ? "✓" : "✗"));
      lines.push(d.question);
      lines.push("  Студент жауабы / Ответ студента: " + d.userAnswerText);
      lines.push("  Дұрыс жауап / Правильный ответ: " + d.correctAnswerText);
    });
    lines.push("");
    lines.push("--- JSON (қосымша) ---");
    lines.push(JSON.stringify(record, null, 0));
    return lines.join("\n");
  }

  function submitResultToTeacherEmail(record) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = FORMSUBMIT_ACTION;
    form.target = "_blank";
    form.acceptCharset = "UTF-8";
    form.style.display = "none";

    function addHidden(name, value) {
      const inp = document.createElement("input");
      inp.type = "hidden";
      inp.name = name;
      inp.value = value;
      form.appendChild(inp);
    }

    addHidden(
      "_subject",
      "[Тест] " +
        record.studentName +
        " · " +
        record.group +
        " · " +
        record.scorePercent +
        "% · " +
        record.submittedAt.slice(0, 16)
    );
    addHidden("_captcha", "false");
    addHidden("message", formatResultPlainText(record));

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  function buildResultRecord(correct, wrong, pct, passed, elapsedSec) {
    const details = sessionQuestions.map(function (q, i) {
      const chosen = answers[i];
      const userIdx = chosen === null || chosen === undefined ? null : chosen;
      const correctIdx = q.correct;
      const correctText = q.options[correctIdx];
      const userText =
        userIdx === null || userIdx === undefined ? "(жауап жоқ / нет ответа)" : q.options[userIdx];
      return {
        questionId: q.id,
        question: q.question,
        userIndex: userIdx,
        correctIndex: correctIdx,
        userAnswerText: userText,
        correctAnswerText: correctText,
        isCorrect: userIdx !== null && userIdx !== undefined && userIdx === correctIdx,
      };
    });

    return {
      id: String(Date.now()) + "_" + Math.random().toString(36).slice(2, 8),
      submittedAt: new Date().toISOString(),
      studentName: student.name,
      group: student.group,
      specialtyValue: student.specialty,
      specialtyLabel: specialtyLabel(student.specialty),
      correctCount: correct,
      wrongCount: wrong,
      total: sessionQuestions.length,
      scorePercent: pct,
      passed: passed,
      timeSpentSec: elapsedSec,
      timeSpentFormatted: formatElapsed(elapsedSec),
      details: details,
    };
  }

  function renderTeacherHistory() {
    if (!el.teacherHistory) return;
    const list = loadResultsHistory();
    if (list.length === 0) {
      el.teacherHistory.innerHTML =
        '<p class="teacher-empty">Әлі ешбір тест тапсырылмаған. / Пока никто не прошёл тест.</p>';
      return;
    }
    const rows = list
      .slice()
      .reverse()
      .map(function (r) {
        const dt = r.submittedAt.replace("T", " ").slice(0, 19);
        return (
          "<div class=\"teacher-row\">" +
          "<span class=\"teacher-row__dt\">" +
          escapeHtml(dt) +
          "</span>" +
          "<span class=\"teacher-row__name\">" +
          escapeHtml(r.studentName) +
          "</span>" +
          "<span class=\"teacher-row__gr\">" +
          escapeHtml(r.group) +
          "</span>" +
          "<span class=\"teacher-row__sc\">" +
          r.scorePercent +
          "% (" +
          r.correctCount +
          "/" +
          r.total +
          ")</span>" +
          "</div>"
        );
      });
    el.teacherHistory.innerHTML = rows.join("");
  }

  function exportResultsCsv() {
    const list = loadResultsHistory();
    if (list.length === 0) {
      window.alert("Әлі дерек жоқ. / Нет данных для экспорта.");
      return;
    }
    const header = [
      "id",
      "submittedAt",
      "studentName",
      "group",
      "specialtyLabel",
      "scorePercent",
      "correctCount",
      "wrongCount",
      "total",
      "passed",
      "timeSpentFormatted",
      "detailsJson",
    ];
    function escCell(v) {
      const s = String(v);
      if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    const lines = [header.join(",")];
    list.forEach(function (r) {
      const row = [
        r.id,
        r.submittedAt,
        r.studentName,
        r.group,
        r.specialtyLabel,
        r.scorePercent,
        r.correctCount,
        r.wrongCount,
        r.total,
        r.passed ? "1" : "0",
        r.timeSpentFormatted,
        JSON.stringify(r.details),
      ].map(escCell);
      lines.push(row.join(","));
    });
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "test_results_" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function fillSelects() {
    SPECIALTIES.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.value;
      opt.textContent = specialtyLine(s);
      el.selectSpecialty.appendChild(opt);
    });
    GROUPS.forEach((g) => {
      const opt = document.createElement("option");
      opt.value = g.value;
      opt.textContent = g.labelKk + " / " + g.labelRu;
      el.selectGroup.appendChild(opt);
    });
  }

  function showScreen(name) {
    el.screenStart.classList.toggle("is-active", name === "start");
    el.screenTest.classList.toggle("is-active", name === "test");
    el.screenResults.classList.toggle("is-active", name === "results");
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickRandomQuestions(bank, n) {
    if (bank.length <= n) return shuffle(bank);
    return shuffle(bank).slice(0, n);
  }

  function formatMmSs(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  function formatElapsed(secUsed) {
    const m = Math.floor(secUsed / 60);
    const s = secUsed % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  function updateTimerPill() {
    el.timerText.textContent = formatMmSs(remainingSec);
    el.timerDisplay.classList.remove("is-warning", "is-critical");
    if (remainingSec <= 60) el.timerDisplay.classList.add("is-critical");
    else if (remainingSec <= 300) el.timerDisplay.classList.add("is-warning");
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function finishTest() {
    if (testEnded) return;
    testEnded = true;
    stopTimer();

    const elapsed = TIME_LIMIT_SEC - remainingSec;
    let correct = 0;
    for (let i = 0; i < sessionQuestions.length; i++) {
      const q = sessionQuestions[i];
      const chosen = answers[i];
      if (chosen !== null && chosen !== undefined && chosen === q.correct) correct++;
    }
    const wrong = sessionQuestions.length - correct;
    const pct = Math.round((correct / sessionQuestions.length) * 100);
    const passed = pct >= PASS_PERCENT;

    el.resultScorePct.textContent = pct + "%";
    el.statCorrect.textContent = String(correct);
    el.statWrong.textContent = String(wrong);
    el.statTotal.textContent = String(sessionQuestions.length);
    el.statTime.textContent = formatElapsed(elapsed);

    el.resultPassLabel.textContent = passed ? "Өттіңіз · Зачёт" : "Өтпедіңіз · Не зачёт";
    el.resultPassLabel.classList.toggle("is-pass", passed);
    el.resultPassLabel.classList.toggle("is-fail", !passed);

    el.resultAvatar.textContent = initials(student.name);
    el.resultName.textContent = student.name;
    el.resultMeta.textContent = student.group + " • " + specialtyLabel(student.specialty);

    const now = new Date();
    const monthsKk = [
      "қаңтар",
      "ақпан",
      "наурыз",
      "сәуір",
      "мамыр",
      "маусым",
      "шілде",
      "тамыз",
      "қыркүйек",
      "қазан",
      "қараша",
      "желтоқсан",
    ];
    const monthsRu = [
      "января",
      "февраля",
      "марта",
      "апреля",
      "мая",
      "июня",
      "июля",
      "августа",
      "сентября",
      "октября",
      "ноября",
      "декабря",
    ];
    const d = now.getDate();
    const m = now.getMonth();
    const t =
      String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    el.resultDate.textContent =
      "Күні: " + d + " " + monthsKk[m] + " · Дата: " + d + " " + monthsRu[m];
    el.resultClock.textContent = "Уақыты: " + t + " · Время: " + t;

    const record = buildResultRecord(correct, wrong, pct, passed, elapsed);
    appendResultRecord(record);
    try {
      submitResultToTeacherEmail(record);
      if (el.resultEmailNotice) {
        el.resultEmailNotice.hidden = false;
        el.resultEmailNotice.innerHTML =
          "Нәтиже <strong>" +
          escapeHtml(TEACHER_EMAIL) +
          '</strong> поштасына жіберу үшін жаңа вкладка ашылды (FormSubmit). ' +
          "Егер вкладка ашылмаса, браузерде popup рұқсатын қосыңыз.<br><span lang=\"ru\">Для отправки на почту открылась новая вкладка. Если нет — разрешите всплывающие окна.</span>";
      }
    } catch (err) {
      console.warn(err);
      if (el.resultEmailNotice) {
        el.resultEmailNotice.hidden = false;
        el.resultEmailNotice.textContent =
          "Поштаға жіберу кезінде қате. Нәтиже осы браузерде сақталған; «CSV экспорт» арқылы жібере аласыз.";
      }
    }

    showScreen("results");
  }

  function tick() {
    remainingSec -= 1;
    if (remainingSec <= 0) {
      remainingSec = 0;
      updateTimerPill();
      finishTest();
      return;
    }
    updateTimerPill();
  }

  function startTimer() {
    stopTimer();
    remainingSec = TIME_LIMIT_SEC;
    updateTimerPill();
    timerId = setInterval(tick, 1000);
  }

  function updateProgress() {
    const n = sessionQuestions.length;
    const idx = currentIndex + 1;
    el.progressLabel.textContent =
      "Сұрақ " + idx + " / " + n + " · Вопрос " + idx + " из " + n;
    const pct = Math.round((idx / n) * 100);
    el.progressPct.textContent = pct + "%";
    el.progressFill.style.width = pct + "%";
  }

  function renderQuestion() {
    const q = sessionQuestions[currentIndex];
    selectedOption = answers[currentIndex];
    el.questionText.textContent = q.question;
    el.optionsList.innerHTML = "";
    q.options.forEach((text, i) => {
      const row = document.createElement("div");
      row.className = "option-item" + (selectedOption === i ? " is-selected" : "");
      const rid = "opt-" + i;
      row.innerHTML =
        '<input type="radio" name="answer" id="' +
        rid +
        '" value="' +
        i +
        '"' +
        (selectedOption === i ? " checked" : "") +
        " />" +
        '<label for="' +
        rid +
        '">' +
        escapeHtml(text) +
        "</label>";
      const input = row.querySelector("input");
      input.addEventListener("change", () => {
        selectedOption = i;
        answers[currentIndex] = i;
        el.optionsList.querySelectorAll(".option-item").forEach((node, j) => {
          node.classList.toggle("is-selected", j === i);
        });
        el.btnNext.disabled = false;
      });
      row.addEventListener("click", (e) => {
        if (e.target.tagName !== "INPUT") input.click();
      });
      el.optionsList.appendChild(row);
    });
    el.btnNext.disabled = selectedOption === null || selectedOption === undefined;
    const isLast = currentIndex === sessionQuestions.length - 1;
    if (isLast) {
      el.btnNextKk.textContent = "Аяқтау";
      el.btnNextRu.textContent = "Завершить тест";
    } else {
      el.btnNextKk.textContent = "Келесі сұрақ →";
      el.btnNextRu.textContent = "Следующий вопрос →";
    }
    updateProgress();
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  el.btnNext.addEventListener("click", () => {
    if (testEnded) return;
    if (currentIndex < sessionQuestions.length - 1) {
      currentIndex += 1;
      renderQuestion();
    } else {
      finishTest();
    }
  });

  el.formStart.addEventListener("submit", (e) => {
    e.preventDefault();
    let ok = true;
    [el.fieldName, el.fieldSpecialty, el.fieldGroup].forEach((f) => f.classList.remove("has-error"));

    const name = el.inputName.value.trim();
    const spec = el.selectSpecialty.value;
    const group = el.selectGroup.value;

    if (!name) {
      el.fieldName.classList.add("has-error");
      ok = false;
    }
    if (!spec) {
      el.fieldSpecialty.classList.add("has-error");
      ok = false;
    }
    if (!group) {
      el.fieldGroup.classList.add("has-error");
      ok = false;
    }
    if (!ok) return;

    if (questionBank.length < TOTAL_PICK) {
      window.alert(
        "Сұрақтар базасы дайын емес немесе жеткіліксіз. Кемінде " +
          TOTAL_PICK +
          " сұрақ керек. data/questions.js файлын тексеріңіз (index.html қалтасындағы data қалтасы).\n\n" +
          "Банк вопросов не готов или слишком мал. Нужно не менее " +
          TOTAL_PICK +
          " вопросов. Проверьте файл data/questions.js рядом с index.html."
      );
      return;
    }

    student = { name, specialty: spec, group };
    sessionQuestions = pickRandomQuestions(questionBank, TOTAL_PICK);
    answers.length = 0;
    for (let i = 0; i < sessionQuestions.length; i++) answers.push(null);
    currentIndex = 0;
    testEnded = false;

    el.testAvatar.textContent = initials(student.name);
    el.testStudentName.textContent = student.name;
    el.testStudentMeta.textContent = student.group + " • " + specialtyLabel(student.specialty);

    showScreen("test");
    startTimer();
    renderQuestion();
  });

  el.btnHome.addEventListener("click", () => {
    stopTimer();
    el.formStart.reset();
    el.selectSpecialty.selectedIndex = 0;
    el.selectGroup.selectedIndex = 0;
    if (el.resultEmailNotice) {
      el.resultEmailNotice.hidden = true;
      el.resultEmailNotice.innerHTML = "";
    }
    afterBankLoad();
    renderTeacherHistory();
    showScreen("start");
  });

  if (el.btnExportCsv) {
    el.btnExportCsv.addEventListener("click", function () {
      exportResultsCsv();
    });
  }

  function loadBankFromGlobal() {
    if (typeof window.QUESTIONS_BANK === "object" && Array.isArray(window.QUESTIONS_BANK)) {
      questionBank = window.QUESTIONS_BANK;
      return true;
    }
    return false;
  }

  function afterBankLoad() {
    const ok = questionBank.length >= TOTAL_PICK;
    if (el.bankError) {
      el.bankError.hidden = ok;
    }
    if (!ok) {
      console.warn("Сұрақтар базасы:", questionBank.length);
    }
    el.btnStart.disabled = !ok;
  }

  function init() {
    fillSelects();
    el.btnStart.disabled = true;
    loadBankFromGlobal();
    afterBankLoad();
    renderTeacherHistory();
  }

  init();
})();

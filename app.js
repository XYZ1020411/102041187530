const STORAGE_KEY = "popquest_mvp_state";

const baseState = {
  currentUser: null,
  users: {},
  giftCodes: {
    "POP-NEWYEAR": { points: 50, role: "all", usedBy: [] },
    "POP-VIPDAY": { points: 80, role: "vip", usedBy: [] },
  },
};

const ui = {
  authForm: document.querySelector("#auth-form"),
  username: document.querySelector("#username"),
  role: document.querySelector("#role"),
  logoutBtn: document.querySelector("#logout-btn"),
  authStatus: document.querySelector("#auth-status"),

  dashboard: document.querySelector("#dashboard-card"),
  actions: document.querySelector("#actions-card"),
  redeem: document.querySelector("#redeem-card"),
  log: document.querySelector("#log-card"),
  admin: document.querySelector("#admin-card"),

  pointsStat: document.querySelector("#points-stat"),
  checkinStat: document.querySelector("#checkin-stat"),
  roleStat: document.querySelector("#role-stat"),

  checkinBtn: document.querySelector("#checkin-btn"),
  taskBtn: document.querySelector("#task-btn"),
  guessInput: document.querySelector("#guess-input"),
  gameBtn: document.querySelector("#game-btn"),
  actionResult: document.querySelector("#action-result"),

  redeemInput: document.querySelector("#redeem-input"),
  redeemBtn: document.querySelector("#redeem-btn"),
  redeemResult: document.querySelector("#redeem-result"),

  adminTarget: document.querySelector("#admin-target"),
  adminPoints: document.querySelector("#admin-points"),
  adminAdjustBtn: document.querySelector("#admin-adjust-btn"),
  newCode: document.querySelector("#new-code"),
  newCodePoints: document.querySelector("#new-code-points"),
  newCodeRole: document.querySelector("#new-code-role"),
  adminCreateCodeBtn: document.querySelector("#admin-create-code-btn"),
  adminResult: document.querySelector("#admin-result"),

  txBody: document.querySelector("#tx-body"),
};

let state = loadState();

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(baseState);
  try {
    return { ...structuredClone(baseState), ...JSON.parse(raw) };
  } catch {
    return structuredClone(baseState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function nowText() {
  return new Date().toLocaleString("zh-TW", { hour12: false });
}

function ensureUser(name, role) {
  if (!state.users[name]) {
    state.users[name] = {
      role,
      points: 0,
      lastCheckin: null,
      tx: [],
    };
  }
  return state.users[name];
}

function addTransaction(name, type, detail, delta) {
  const user = state.users[name];
  user.points += delta;
  user.tx.unshift({
    time: nowText(),
    type,
    detail,
    delta,
    balance: user.points,
  });
}

function currentUserData() {
  if (!state.currentUser) return null;
  return state.users[state.currentUser] ?? null;
}

function render() {
  const user = currentUserData();
  const isLogin = Boolean(user);

  [ui.dashboard, ui.actions, ui.redeem, ui.log].forEach((el) => el.classList.toggle("hidden", !isLogin));
  ui.logoutBtn.disabled = !isLogin;

  if (!isLogin) {
    ui.authStatus.textContent = "尚未登入。";
    ui.admin.classList.add("hidden");
    ui.txBody.innerHTML = "";
    return;
  }

  ui.authStatus.textContent = `目前登入：${state.currentUser}（${roleText(user.role)}）`;
  ui.pointsStat.textContent = String(user.points);
  ui.checkinStat.textContent = user.lastCheckin === todayKey() ? "今日已簽到" : "未簽到";
  ui.roleStat.textContent = roleText(user.role);
  ui.checkinBtn.disabled = user.lastCheckin === todayKey();

  ui.txBody.innerHTML = user.tx
    .map(
      (tx) => `
      <tr>
        <td>${tx.time}</td>
        <td>${tx.type}</td>
        <td>${tx.detail}</td>
        <td class="${tx.delta >= 0 ? "delta-plus" : "delta-minus"}">${tx.delta >= 0 ? "+" : ""}${tx.delta}</td>
        <td>${tx.balance}</td>
      </tr>`
    )
    .join("");

  const isAdmin = user.role === "admin";
  ui.admin.classList.toggle("hidden", !isAdmin);

  if (isAdmin) {
    const options = Object.keys(state.users)
      .map((name) => `<option value="${name}">${name}（${roleText(state.users[name].role)}）</option>`)
      .join("");
    ui.adminTarget.innerHTML = options;
  }
}

function roleText(role) {
  if (role === "vip") return "VIP";
  if (role === "admin") return "管理員";
  return "一般使用者";
}

ui.authForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = ui.username.value.trim();
  const role = ui.role.value;
  if (!name) return;

  ensureUser(name, role);
  state.currentUser = name;
  saveState();
  render();
});

ui.logoutBtn.addEventListener("click", () => {
  state.currentUser = null;
  saveState();
  render();
});

ui.checkinBtn.addEventListener("click", () => {
  const user = currentUserData();
  if (!user || user.lastCheckin === todayKey()) return;

  const delta = user.role === "vip" ? 20 : 10;
  user.lastCheckin = todayKey();
  addTransaction(state.currentUser, "簽到", "每日簽到獎勵", delta);
  ui.actionResult.textContent = `簽到成功，獲得 ${delta} 點。`;

  saveState();
  render();
});

ui.taskBtn.addEventListener("click", () => {
  if (!currentUserData()) return;
  addTransaction(state.currentUser, "任務", "完成日常任務", 15);
  ui.actionResult.textContent = "任務完成，獲得 15 點。";
  saveState();
  render();
});

ui.gameBtn.addEventListener("click", () => {
  const guess = Number(ui.guessInput.value);
  if (!currentUserData() || !Number.isInteger(guess) || guess < 1 || guess > 5) {
    ui.actionResult.textContent = "請輸入 1 到 5 的整數。";
    return;
  }

  const answer = Math.floor(Math.random() * 5) + 1;
  const win = guess === answer;
  const delta = win ? 30 : 5;
  addTransaction(state.currentUser, "遊戲", `猜數字：你猜 ${guess}，答案 ${answer}`, delta);
  ui.actionResult.textContent = win ? `猜中！+${delta} 點。` : `沒猜中，但仍獲得安慰獎 +${delta} 點。`;

  saveState();
  render();
});

ui.redeemBtn.addEventListener("click", () => {
  const code = ui.redeemInput.value.trim().toUpperCase();
  const user = currentUserData();
  if (!user || !code) return;

  const gift = state.giftCodes[code];
  if (!gift) {
    ui.redeemResult.textContent = "禮包碼不存在。";
    return;
  }

  if (gift.role === "vip" && user.role !== "vip") {
    ui.redeemResult.textContent = "此禮包碼僅限 VIP 使用。";
    return;
  }

  if (gift.usedBy.includes(state.currentUser)) {
    ui.redeemResult.textContent = "你已經兌換過這組禮包碼。";
    return;
  }

  gift.usedBy.push(state.currentUser);
  addTransaction(state.currentUser, "禮包碼", `兌換 ${code}`, gift.points);
  ui.redeemResult.textContent = `兌換成功，獲得 ${gift.points} 點。`;

  saveState();
  render();
});

ui.adminAdjustBtn.addEventListener("click", () => {
  const admin = currentUserData();
  if (!admin || admin.role !== "admin") return;

  const target = ui.adminTarget.value;
  const delta = Number(ui.adminPoints.value);
  if (!target || Number.isNaN(delta)) return;

  addTransaction(target, "管理員調整", `由 ${state.currentUser} 調整`, delta);
  ui.adminResult.textContent = `已調整 ${target} ${delta >= 0 ? "+" : ""}${delta} 點。`;
  saveState();
  render();
});

ui.adminCreateCodeBtn.addEventListener("click", () => {
  const admin = currentUserData();
  if (!admin || admin.role !== "admin") return;

  const code = ui.newCode.value.trim().toUpperCase();
  const points = Number(ui.newCodePoints.value);
  const role = ui.newCodeRole.value;

  if (!code || Number.isNaN(points) || points <= 0) {
    ui.adminResult.textContent = "請輸入有效禮包碼與正整數積分。";
    return;
  }

  if (state.giftCodes[code]) {
    ui.adminResult.textContent = "禮包碼已存在。";
    return;
  }

  state.giftCodes[code] = { points, role, usedBy: [] };
  ui.adminResult.textContent = `成功建立禮包碼 ${code}（${points} 點 / ${role === "vip" ? "僅 VIP" : "所有人"}）。`;

  saveState();
  render();
});

render();

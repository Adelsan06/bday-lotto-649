// app.js (TOP OF FILE)

// Firebase imports (browser-safe)
alert("app.js loaded");
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { auth } from "./firebase.js";

import {
  signup,
  login,
  logout,
  loadCurrentMember
} from "./auth.js";

import {
  ensureSeason,
  getSeason,
  setWinningNumbers,
  addEntry,
  listEntries,
  endSeasonWithWinners
} from "./db.js";

import {
  normalize6,
  computeMatch,
  splitPool
} from "./rules.js";


// =========================================================
// app.js
// - Main UI wiring
// - This is the only file that touches the DOM heavily
// =========================================================

import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { signup, login, logout, loadCurrentMember } from "./auth.js";
import { ensureSeason, getSeason, setWinningNumbers, addEntry, listEntries, endSeasonWithWinners } from "./db.js";
import { normalize6, computeMatch, splitPool } from "./rules.js";

// ==========================
// CONFIG YOU EDIT
// ==========================
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/test_9B6fZa3nH13m4Ll2UZ0x200"; // <-- replace this
const stripe = require('stripe')('{{sk_test_51Sh3MO2NOZdOoPdmRwSnjTzmOTNYkpkNbwaYzdug5UDxtKjJLMQ1fmQp9MfiJivf1UfaSi3NCy88NhcAmwAFKqPG00HAIAXEq9}}');

const price = await stripe.prices.update('price_1Sh3Xk2NOZdOoPdm0FFHI2Zu');

const DEFAULT_ENTRY_FEE_CENTS = 500; // $5 (should match season entryFeeCents)

// ==========================
// DOM ELEMENTS (FIXED)
// ==========================
const authBox = document.getElementById("authBox");
const appBox = document.getElementById("app");

const btnSignup = document.getElementById("btnSignup");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");

const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authMsg = document.getElementById("authMsg");

// ==========================
// UI Rendering
// ==========================
async function refreshAll(){
  await ensureSeason();

  const season = await getSeason();
  const entries = await listEntries();

  renderSeason(season);
  renderEntries(entries, season?.winningNumbers || []);
}

function renderSeason(season){
  if (!season){
    seasonStatusPill.textContent = "Season: —";
    return;
  }

  stripeLink.href = STRIPE_PAYMENT_LINK;
  stripeLink.textContent = season.ended ? "Season Ended" : "Pay to Enter";

  seasonStatusPill.textContent = season.ended ? "Season: ENDED" : "Season: ACTIVE";
  poolPill.textContent = `Pool: ${money(season.poolCents || 0)}`;

  const { prize, house } = splitPool((season.poolCents || 0));
  payoutPill.textContent = `85% Prize: ${money(Math.round(prize))}`;
  housePill.textContent = `15% House: ${money(Math.round(house))}`;

  const wn = (season.winningNumbers || []).length ? (season.winningNumbers.join(", ")) : "—";
  winningLine.textContent = `Winning numbers: ${wn}`;
}

function renderEntries(entries, winningNumbers){
  entriesTbody.innerHTML = entries.map(e => {
    const picks = e.picks || [];
    const { matched, matchCount } = computeMatch(picks, winningNumbers);

    const picksHtml = picks.map(n => {
      const isMatch = (winningNumbers || []).includes(n);
      return `<span class="${isMatch ? "match" : ""}">${n}</span>`;
    }).join(" ");

    let statusTag = `<span class="tagNone">Playing</span>`;
    if (matchCount === 6) statusTag = `<span class="tagOk">BINGO READY</span>`;
    else if (matchCount >= 3) statusTag = `<span class="tagWarn">${matchCount}/6 matched</span>`;

    return `
      <tr>
        <td><strong>${escapeHtml(e.name || "Member")}</strong></td>
        <td class="nums">${escapeHtml(e.registeredId || "—")}</td>
        <td class="nums">${picksHtml}</td>
        <td class="nums">${matchCount}/6 (${matched.join(", ") || "—"})</td>
        <td>${statusTag}</td>
      </tr>
    `;
  }).join("");
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[s]));
}

// ==========================
// Actions
// ==========================
btnSignup.addEventListener("click", async () => {
  setMsg(authMsg, "");
  try{
    if (!authName.value.trim()) return setMsg(authMsg, "Name is required for signup.");
    await signup({
      name: authName.value.trim(),
      email: authEmail.value.trim(),
      password: authPassword.value
    });
  } catch (e){
    setMsg(authMsg, e.message);
  }
});

btnLogin.addEventListener("click", async () => {
  setMsg(authMsg, "");
  try{
    await login({
      email: authEmail.value.trim(),
      password: authPassword.value
    });
  } catch (e){
    setMsg(authMsg, e.message);
  }
});

btnLogout.addEventListener("click", async () => {
  await logout();
});

btnPaidSubmit.addEventListener("click", async () => {
  setMsg(entryMsg, "");

  const season = await getSeason();
  if (season?.ended){
    return setMsg(entryMsg, "Season has ended. Wait for next season.");
  }

  const member = await loadCurrentMember();
  if (!member){
    return setMsg(entryMsg, "Not logged in.");
  }

  const picksRaw = picksInputs().map(i => i.value);
  const picks = normalize6(picksRaw);

  if (!picks){
    return setMsg(entryMsg, "Enter 6 UNIQUE numbers from 1–49.");
  }

  // NOTE: This is NOT verified payment — it assumes the user paid.
  // For real enforcement, you must add Stripe webhook verification.
  const entryFeeCents = season?.entryFeeCents ?? DEFAULT_ENTRY_FEE_CENTS;

  const entryId = await addEntry({
    uid: auth.currentUser.uid,
    name: member.name,
    registeredId: member.registeredId,
    picks,
    entryFeeCents
  });

  picksInputs().forEach(i => i.value = "");
  setMsg(entryMsg, `Entry saved (ID: ${entryId}). Good luck!`);
  await refreshAll();
});

btnSaveWinning.addEventListener("click", async () => {
  setMsg(winMsg, "");
  const season = await getSeason();
  if (season?.ended){
    return setMsg(winMsg, "Season ended. Can't change winning numbers.");
  }

  const winningRaw = winInputs().map(i => i.value);
  const winning = normalize6(winningRaw);

  if (!winning){
    return setMsg(winMsg, "Enter 6 UNIQUE winning numbers 1–49.");
  }

  await setWinningNumbers(winning);
  setMsg(winMsg, "Winning numbers saved.");
  await refreshAll();
});

btnClaimBingo.addEventListener("click", async () => {
  setMsg(bingoMsg, "");

  const season = await getSeason();
  if (season?.ended){
    return setMsg(bingoMsg, "Season already ended.");
  }

  const member = await loadCurrentMember();
  if (!member) return setMsg(bingoMsg, "Not logged in.");

  // Find all entries with 6/6 matched (client-side).
  // WARNING: This is not secure without server verification.
  const entries = await listEntries();
  const winning = season?.winningNumbers || [];

  if (winning.length !== 6){
    return setMsg(bingoMsg, "Winning numbers not set yet.");
  }

  const winners = entries
    .map(e => {
      const { matchCount } = computeMatch(e.picks || [], winning);
      return { e, matchCount };
    })
    .filter(x => x.matchCount === 6);

  // Only allow claim if current member is among winners
  const isMeWinner = winners.some(w => w.e.uid === auth.currentUser.uid);
  if (!isMeWinner){
    return setMsg(bingoMsg, "You cannot claim bingo unless you have 6/6 matched.");
  }

  // End season with winner list (split prize externally or calculate in UI)
  const winnersPayload = winners.map(w => ({
    uid: w.e.uid,
    registeredId: w.e.registeredId,
    name: w.e.name,
    entryId: w.e.id,
    claimedAt: new Date().toISOString()
  }));

  await endSeasonWithWinners(winnersPayload);

  const totalWinners = winnersPayload.length;
  setMsg(bingoMsg, `Season ended! Winners: ${totalWinners}. Prize is split among winners (85% of pool).`);
  await refreshAll();
});

// ==========================
// Auth State
// ==========================
onAuthStateChanged(auth, async (user) => {
  if (user){
    authBox.style.display = "none";
    appBox.style.display = "block";

    const member = await loadCurrentMember();
    memberLine.textContent = member
      ? `Member: ${member.name} • Registered ID: ${member.registeredId}`
      : `Member: ${user.email}`;

    await refreshAll();
  } else {
    appBox.style.display = "none";
    authBox.style.display = "block";
    setMsg(authMsg, "");
  }
});


// =========================================================
// db.js
// - Firestore data model
// - Keeps your app logic clean and easy to update
//
// Data model (simple):
// season/current
//   - ended: boolean
//   - winningNumbers: number[]
//   - poolCents: number
//   - entryFeeCents: number (e.g., 500 for $5)
//   - winners: array of { uid, registeredId, name, entryId, claimedAt }
//
// members/{uid}
//   - name, registeredId, createdAt
//
// entries (collection):
// entries/{entryId}
//   - uid, name, registeredId
//   - picks: number[]
//   - createdAt
// =========================================================

import {
  doc, getDoc, setDoc, serverTimestamp,
  collection, addDoc, getDocs, query, orderBy,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db } from "./firebase.js";

const seasonRef = doc(db, "season", "current");

export async function ensureSeason(){
  const snap = await getDoc(seasonRef);
  if (!snap.exists()){
    await setDoc(seasonRef, {
      ended: false,
      winningNumbers: [],
      poolCents: 0,
      entryFeeCents: 500, // $5 default
      winners: [],
      createdAt: serverTimestamp()
    });
  }
}

export async function getSeason(){
  const snap = await getDoc(seasonRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function setWinningNumbers(winningNumbers){
  await updateDoc(seasonRef, { winningNumbers });
}

export async function endSeasonWithWinners(winners){
  await updateDoc(seasonRef, {
    ended: true,
    winners,
    endedAt: serverTimestamp()
  });
}

export async function getMember(uid){
  const ref = doc(db, "members", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export async function createMember(uid, name, registeredId){
  const ref = doc(db, "members", uid);
  await setDoc(ref, {
    name,
    registeredId,
    createdAt: serverTimestamp()
  });
}

export async function addEntry({ uid, name, registeredId, picks, entryFeeCents }){
  // Add entry
  const entriesRef = collection(db, "entries");
  const entryDoc = await addDoc(entriesRef, {
    uid, name, registeredId,
    picks,
    createdAt: serverTimestamp()
  });

  // Increase pool
  const season = await getSeason();
  const newPool = (season?.poolCents || 0) + entryFeeCents;
  await updateDoc(seasonRef, { poolCents: newPool });

  return entryDoc.id;
}

export async function listEntries(){
  const q = query(collection(db, "entries"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

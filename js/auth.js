// =========================================================
// auth.js
// - Signup/Login/Logout
// - Creates member profile with Registered ID
// =========================================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { auth } from "./firebase.js";
import { createMember, getMember } from "./db.js";

function makeRegisteredId(){
  // Example: P-20251222-1234
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  const rnd = String(Math.floor(Math.random()*9000)+1000);
  return `P-${y}${m}${day}-${rnd}`;
}

export async function signup({ name, email, password }){
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  const regId = makeRegisteredId();
  await createMember(uid, name || "Member", regId);

  return { uid };
}

export async function login({ email, password }){
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return { uid: cred.user.uid };
}

export async function logout(){
  await signOut(auth);
}

export async function loadCurrentMember(){
  const user = auth.currentUser;
  if (!user) return null;
  return await getMember(user.uid);
}

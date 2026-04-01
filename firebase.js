import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-analytics.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js";


const firebaseConfig = {
  apiKey: "AIzaSyA3eQP96L1EmleBx8gcvKcMxYoFQsa2Qe0",
  authDomain: "thiransmartconnect.firebaseapp.com",
  projectId: "thiransmartconnect",
  storageBucket: "thiransmartconnect.firebasestorage.app",
  messagingSenderId: "851500836976",
  appId: "1:851500836976:web:67ef9c8a50449cc5b32cb5",
  measurementId: "G-19JEY3TE2L"
};

const app = initializeApp(firebaseConfig);
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (e) {
  console.warn("Analytics blocked or failed to initialize", e);
}
export const db = getFirestore(app);
export const storage = getStorage(app);

// Exporting helpers for script.js
export { doc, setDoc, getDoc, collection, query, getDocs, deleteDoc, ref, uploadString, getDownloadURL };

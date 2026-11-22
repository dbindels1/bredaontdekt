import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDVZI_O8LH2uYT2MiLHZ18AB3ku80r4xYs",
  authDomain: "denbin-f28d2.firebaseapp.com",
  projectId: "denbin-f28d2",
  storageBucket: "denbin-f28d2.firebasestorage.app",
  messagingSenderId: "156339160520",
  appId: "1:156339160520:web:09508d26266a1bf41e2cfd"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

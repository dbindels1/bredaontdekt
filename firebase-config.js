  const firebaseConfig = {
    apiKey: "AIzaSyDVZI_O8LH2uYT2MiLHZ18AB3ku80r4xYs",
    authDomain: "denbin-f28d2.firebaseapp.com",
    projectId: "denbin-f28d2",
    storageBucket: "denbin-f28d2.firebasestorage.app",
    messagingSenderId: "156339160520",
    appId: "1:156339160520:web:09508d26266a1bf41e2cfd"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);

  const db = firebase.firestore();
  const auth = firebase.auth();

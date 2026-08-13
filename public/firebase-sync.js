/* Firebase tourism bridge - no Firebase Storage required.
   Uses Firestore for tourism/cell metadata and external/Hosting URLs for images. */
(function () {
  const CDN = "https://www.gstatic.com/firebasejs/10.14.1/";
  let readyPromise = null;
  let db = null, auth = null;

  function configured() {
    const c = window.FIREBASE_CONFIG;
    return c && c.apiKey && !String(c.apiKey).startsWith("PASTE_") &&
      c.projectId === "bordgame-v263-prototype" &&
      c.appId && !String(c.appId).startsWith("PASTE_");
  }

  async function ready() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      if (!configured()) throw new Error("ยังไม่ได้ใส่ Firebase Web App config");
      const appMod = await import(CDN + "firebase-app.js");
      const fsMod = await import(CDN + "firebase-firestore.js");
      const authMod = await import(CDN + "firebase-auth.js");
      const app = appMod.getApps().length
        ? appMod.getApps()[0]
        : appMod.initializeApp(window.FIREBASE_CONFIG);
      db = fsMod.getFirestore(app);
      auth = authMod.getAuth(app);
      return { app, db, auth, fsMod, authMod };
    })();
    return readyPromise;
  }

  async function getDistricts() {
    const {db,fsMod}=await ready();
    const snap=await fsMod.getDocs(fsMod.collection(db,"tourism_districts"));
    const districts=snap.docs.map(d=>d.data()).sort((a,b)=>(a.position||0)-(b.position||0));
    return districts;
  }

  async function seedTourism(data) {
    const {db,fsMod}=await ready();
    const batch=fsMod.writeBatch(db);
    (data.districts||[]).forEach((d,i)=>{
      const id=String(d.cellId || ("district-"+(i+1))).replace(/[\/#?[\]]/g,"_");
      batch.set(fsMod.doc(db,"tourism_districts",id), {...d, updatedAt:new Date().toISOString()},{merge:true});
    });
    await batch.commit();
    return data.districts?.length || 0;
  }

  async function signIn(email,password) {
    const {auth,authMod}=await ready();
    const cred=await authMod.signInWithEmailAndPassword(auth,email,password);
    return cred.user;
  }

  async function signOut() {
    const {auth,authMod}=await ready();
    await authMod.signOut(auth);
  }

  async function saveDistrict(d) {
    const {db,fsMod}=await ready();
    const id=String(d.cellId || d.district).replace(/[\\/#?\[\]]/g,"_");
    await fsMod.setDoc(fsMod.doc(db,"tourism_districts",id),{...d,updatedAt:new Date().toISOString()},{merge:true});
    return d;
  }

  async function saveCell(cell) {
    const {db,fsMod}=await ready();
    const id=String(cell.id).replace(/[\/#?[\]]/g,"_");
    await fsMod.setDoc(fsMod.doc(db,"board_cells",id),cell,{merge:true});
    return cell;
  }

  async function getCells() {
    const {db,fsMod}=await ready();
    const snap=await fsMod.getDocs(fsMod.collection(db,"board_cells"));
    return snap.docs.map(d=>d.data()).sort((a,b)=>(a.position||0)-(b.position||0));
  }

  window.FirebaseTourism = {
    ready, configured, getDistricts, seedTourism, signIn, signOut, saveDistrict, saveCell, getCells
  };
})();
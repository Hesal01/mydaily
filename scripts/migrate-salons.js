/**
 * Migration : rattache les données existantes au salon d'origine.
 *
 * À lancer UNE FOIS avant de déployer la version « salons ». Sans ça, les docs
 * d'avant n'ont pas de `salonId` et deviennent invisibles pour les requêtes
 * filtrées de l'app.
 *
 * Le script est idempotent : les docs déjà taggés sont ignorés, on peut le
 * relancer sans risque.
 *
 * Usage: node scripts/migrate-salons.js [--dry-run]
 */

const { admin, db, fail } = require('./lib/admin');

const SALON_ID = 'salon_1';
const SALON_NAME = 'Les originaux';
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Rattache au salon d'origine tous les docs d'une collection qui n'ont pas
 * encore d'appartenance.
 *
 * `users` et `habits` portent un tableau `salonIds` (une personne peut être
 * dans plusieurs salons, et sa journée est alors visible dans chacun).
 * `congratulations` porte un `salonId` simple : un bravo est envoyé depuis un
 * salon précis.
 */
async function tagCollection(name, field) {
  const snapshot = await db.collection(name).get();
  const todo = snapshot.docs.filter(doc => !doc.data()[field]);

  console.log(`${name}: ${todo.length} doc(s) à taguer sur ${snapshot.size}`);
  if (DRY_RUN || todo.length === 0) return todo.length;

  const value = field === 'salonIds' ? [SALON_ID] : SALON_ID;

  // Firestore plafonne un batch à 500 opérations.
  for (let i = 0; i < todo.length; i += 500) {
    const batch = db.batch();
    todo.slice(i, i + 500).forEach(doc => batch.update(doc.ref, { [field]: value }));
    await batch.commit();
    console.log(`  ${Math.min(i + 500, todo.length)}/${todo.length}`);
  }
  return todo.length;
}

/**
 * Fige l'emoji de chaque personne dans `animalIndex`, au lieu de le déduire du
 * numéro dans l'id : les salons suivants n'auront pas d'ids numérotés.
 */
async function setAnimalIndexes() {
  const snapshot = await db.collection('users').where('salonIds', 'array-contains', SALON_ID).get();
  const users = snapshot.docs
    .map(doc => ({ ref: doc.ref, id: doc.id, data: doc.data() }))
    .sort((a, b) => (a.data.displayOrder ?? 0) - (b.data.displayOrder ?? 0));

  const todo = users.filter(u => !Number.isInteger(u.data.animalIndex));
  console.log(`users: ${todo.length} animalIndex à écrire`);
  if (DRY_RUN || todo.length === 0) return;

  const batch = db.batch();
  users.forEach((u, i) => {
    if (!Number.isInteger(u.data.animalIndex)) batch.update(u.ref, { animalIndex: i });
  });
  await batch.commit();
}

async function main() {
  if (DRY_RUN) console.log('--- DRY RUN, aucune écriture ---\n');

  if (!DRY_RUN) {
    await db.collection('salons').doc(SALON_ID).set({
      name: SALON_NAME,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`Salon ${SALON_ID} ("${SALON_NAME}") créé\n`);
  }

  await tagCollection('users', 'salonIds');
  await tagCollection('habits', 'salonIds');
  await tagCollection('congratulations', 'salonId');
  await setAnimalIndexes();

  console.log('\n✅ Migration terminée.');
}

main()
  .then(() => process.exit(0))
  .catch(fail);

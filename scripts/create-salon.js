/**
 * Crée un nouveau salon et ses membres, avec un lien d'accès par personne.
 *
 * Un salon est une grille indépendante : ses membres ne voient que leurs
 * données, et personne d'autre ne voit les leurs.
 *
 * Deux façons d'identifier les membres dans la grille :
 *   - des initiales, une par personne  -> node scripts/create-salon.js salon_2 "Les cousins" JK,MA,SB
 *   - les emojis animaux (par défaut)  -> node scripts/create-salon.js salon_2 "Les cousins" 6
 *
 * Usage:
 *   node scripts/create-salon.js <salonId> "<nom du salon>" <initiales|nombre>
 */

const { admin, db, fail } = require('./lib/admin');

const APP_URL = 'https://mydaily-8d939.web.app';
/** Doit rester aligné sur USER_ICONS (src/app/core/constants/habits.constants.ts). */
const ANIMALS = ['🦥', '🐘', '🦉', '🐈', '🐜', '🐆', '🐬', '🐇', '🐫'];
const MAX_MEMBERS = ANIMALS.length;

const [salonId, salonName, membersArg] = process.argv.slice(2);

if (!salonId || !salonName || !membersArg) {
  console.error('Usage: node scripts/create-salon.js <salonId> "<nom>" <initiales|nombre>');
  console.error('  ex: node scripts/create-salon.js salon_2 "Les cousins" JK,MA,SB');
  console.error('  ex: node scripts/create-salon.js salon_2 "Les cousins" 6');
  process.exit(1);
}

// Un nombre -> emojis animaux. Une liste -> initiales, une par personne.
const asCount = /^\d+$/.test(membersArg.trim());
const labels = asCount
  ? null
  : membersArg.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
const size = asCount ? parseInt(membersArg, 10) : labels.length;

if (size < 1) {
  console.error('Il faut au moins une personne.');
  process.exit(1);
}
if (asCount && size > MAX_MEMBERS) {
  console.error(`Avec les emojis, maximum ${MAX_MEMBERS} personnes. Passe des initiales pour un salon plus grand.`);
  process.exit(1);
}
if (labels) {
  const bad = labels.filter(l => l.length < 2 || l.length > 3);
  if (bad.length > 0) {
    console.error(`Initiales attendues sur 2 ou 3 caractères, reçu : ${bad.join(', ')}`);
    process.exit(1);
  }
  if (new Set(labels).size !== labels.length) {
    console.error('Deux personnes ne peuvent pas avoir les mêmes initiales.');
    process.exit(1);
  }
}

// Alphabet sans caractères ambigus (0/O, 1/l/I) : ces tokens se recopient à la main.
function generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

async function main() {
  const existing = await db.collection('salons').doc(salonId).get();
  if (existing.exists) {
    console.error(`Le salon ${salonId} existe déjà. Choisis un autre id.`);
    process.exit(1);
  }

  await db.collection('salons').doc(salonId).set({
    name: salonName,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const members = Array.from({ length: size }, (_, i) => ({
    // Id préfixé par le salon : les ids doivent rester uniques dans toute la
    // base, les docs habits étant identifiés par `${date}_${userId}`.
    id: `${salonId}_user_${i + 1}`,
    token: generateToken(),
    displayOrder: i + 1,
    label: labels ? labels[i] : null,
    animalIndex: i
  }));

  const batch = db.batch();
  members.forEach(member => {
    const data = {
      // Tableau : une personne peut ensuite être ajoutée à d'autres salons
      // (cf. scripts/add-to-salon.js).
      salonIds: [salonId],
      token: member.token,
      displayOrder: member.displayOrder,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    // `label` prime sur `animalIndex` à l'affichage : on n'écrit que l'un des deux.
    if (member.label) data.label = member.label;
    else data.animalIndex = member.animalIndex;
    batch.set(db.collection('users').doc(member.id), data);
  });
  await batch.commit();

  console.log(`\n✅ Salon "${salonName}" (${salonId}) créé avec ${size} personne(s).\n`);
  console.log('Liens d\'accès — un par personne, à ne pas mélanger :\n');
  members.forEach(m => console.log(`  ${m.label || ANIMALS[m.animalIndex]}  ${APP_URL}/?token=${m.token}`));
  console.log('\nGarde ces liens quelque part : les tokens ne sont pas récupérables autrement.');
}

main()
  .then(() => process.exit(0))
  .catch(fail);

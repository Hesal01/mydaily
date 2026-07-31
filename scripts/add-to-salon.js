/**
 * Ajoute une personne existante à un salon supplémentaire.
 *
 * Elle garde un seul lien d'accès et coche ses habitudes une seule fois : sa
 * journée devient visible dans toutes les grilles de ses salons. Un sélecteur
 * apparaît dans l'app dès qu'elle appartient à plus d'un salon.
 *
 * `--label` ne vaut que pour le salon rejoint : son badge d'origine ne bouge
 * pas ailleurs. Chaque grille identifie les gens à sa façon.
 *
 * Par défaut son historique est repris dans le nouveau salon (les journées
 * passées y deviennent visibles). `--no-history` limite la visibilité à partir
 * d'aujourd'hui.
 *
 * Usage:
 *   node scripts/add-to-salon.js <userId> <salonId> [--label=JK] [--no-history] [--dry-run]
 *
 * Exemple:
 *   node scripts/add-to-salon.js user_3 salon_2 --label=JK
 */

const { admin, db, fail } = require('./lib/admin');

const args = process.argv.slice(2);
const [userId, salonId] = args.filter(a => !a.startsWith('--'));
const DRY_RUN = args.includes('--dry-run');
const NO_HISTORY = args.includes('--no-history');
const labelArg = args.find(a => a.startsWith('--label='));
const label = labelArg ? labelArg.slice('--label='.length).trim().toUpperCase() : null;

if (!userId || !salonId) {
  console.error('Usage: node scripts/add-to-salon.js <userId> <salonId> [--label=JK] [--no-history] [--dry-run]');
  process.exit(1);
}
if (label && (label.length < 2 || label.length > 3)) {
  console.error('Initiales attendues sur 2 ou 3 caractères.');
  process.exit(1);
}

async function main() {
  if (DRY_RUN) console.log('--- DRY RUN, aucune écriture ---\n');

  const userRef = db.collection('users').doc(userId);
  const [userDoc, salonDoc] = await Promise.all([
    userRef.get(),
    db.collection('salons').doc(salonId).get()
  ]);

  if (!userDoc.exists) {
    console.error(`Utilisateur inconnu : ${userId}`);
    process.exit(1);
  }
  if (!salonDoc.exists) {
    console.error(`Salon inconnu : ${salonId}. Crée-le d'abord avec create-salon.js.`);
    process.exit(1);
  }

  const current = userDoc.data().salonIds || [];
  if (current.includes(salonId)) {
    console.log(`${userId} est déjà dans ${salonId}, rien à faire.`);
    return;
  }

  // Les habitudes passées de la personne, à rendre visibles dans le nouveau salon.
  const habitsSnapshot = await db.collection('habits').where('userId', '==', userId).get();

  console.log(`${userId} → ${salonId} ("${salonDoc.data().name}")`);
  console.log(`  salons actuels : ${current.join(', ') || '(aucun)'}`);
  if (label) console.log(`  badge dans ce salon : ${label} (inchangé dans les autres)`);
  console.log(`  historique : ${NO_HISTORY ? 'non repris' : `${habitsSnapshot.size} journée(s) à reprendre`}`);

  if (DRY_RUN) return;

  const userUpdate = { salonIds: admin.firestore.FieldValue.arrayUnion(salonId) };
  // Badge propre au salon rejoint : la personne garde son badge d'origine dans
  // ses autres salons (un jaguar peut devenir « MI » ici et rester 🐆 ailleurs).
  if (label) userUpdate[`labels.${salonId}`] = label;
  await userRef.update(userUpdate);

  if (!NO_HISTORY && habitsSnapshot.size > 0) {
    const docs = habitsSnapshot.docs;
    // Firestore plafonne un batch à 500 opérations.
    for (let i = 0; i < docs.length; i += 500) {
      const batch = db.batch();
      docs.slice(i, i + 500).forEach(doc => {
        batch.update(doc.ref, { salonIds: admin.firestore.FieldValue.arrayUnion(salonId) });
      });
      await batch.commit();
      console.log(`  historique ${Math.min(i + 500, docs.length)}/${docs.length}`);
    }
  }

  console.log(`\n✅ ${userId} fait maintenant partie de ${salonId}.`);
  console.log('   Son lien d\'accès ne change pas ; le sélecteur de salon apparaît dans l\'app.');
  console.log('   Note : son displayOrder est global, sa position dans la nouvelle grille');
  console.log('   peut donc tomber à égalité avec un membre existant.');
}

main()
  .then(() => process.exit(0))
  .catch(fail);

# Mydaily

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.1.0.

## Salons

Un **salon** est un groupe indépendant : sa propre grille, ses propres
habitudes, ses propres bravos. Deux salons ne se voient jamais, ni dans l'app ni
dans les notifications push.

Les docs `users` et `habits` portent un tableau `salonIds`, les `congratulations`
un `salonId` simple (un bravo part d'un salon précis). Toutes les lectures de
l'app sont filtrées dessus. Le token d'accès reste personnel ; c'est le doc user
qui rattache la personne à ses salons.

### Créer un salon

Chaque personne est identifiée dans la grille par un **badge** : soit ses
initiales, soit un emoji animal.

```bash
node scripts/create-salon.js salon_2 "Les cousins" JK,MA,SB   # initiales
node scripts/create-salon.js salon_2 "Les cousins" 6          # emojis animaux
```

Les initiales lèvent la limite de 9 personnes (le nombre d'emojis disponibles)
et se règlent par personne via le champ `label` du doc user.

Le script affiche un lien d'accès par personne. Les tokens ne sont pas
récupérables ensuite : à garder.

### Scripts d'administration

Les scripts `scripts/*.js` écrivent avec l'Admin SDK et ont besoin de
credentials : soit la clé de service à la racine du repo (gitignorée), soit
`gcloud auth application-default login`. Sans ça ils s'arrêtent en expliquant
comment s'authentifier.

### Migration (une seule fois)

Avant le premier déploiement de la version salons, rattacher les données
existantes au salon d'origine :

```bash
node scripts/migrate-salons.js --dry-run   # aperçu
node scripts/migrate-salons.js             # pour de vrai
```

⚠️ **Ordre impératif** : la migration doit passer *avant* le déploiement du
hosting. Sans `salonIds`, les documents existants sont invisibles pour les
requêtes filtrées et les grilles s'affichent vides.

La requête des habitudes demande un index composite (`salonIds` array-contains +
`date`), déclaré dans `firestore.indexes.json` :

```bash
firebase deploy --only firestore:indexes
```

### Quelqu'un dans plusieurs salons

Une personne peut appartenir à plusieurs salons avec **un seul lien d'accès**.
Elle coche ses habitudes une fois et sa journée apparaît dans chaque grille ;
un sélecteur de salon s'affiche en haut de l'app dès qu'elle en a plus d'un.

```bash
node scripts/add-to-salon.js user_3 salon_2 --label=JK
node scripts/add-to-salon.js user_3 salon_2 --no-history   # visible à partir d'aujourd'hui
```

Par défaut l'historique est repris : les journées passées deviennent visibles
dans le nouveau salon. Ce qui est partagé entre ses salons : les habitudes, la
progression de lecture et d'étude, et le mode privé — tout ce qui est porté par
la personne. Ce qui reste cloisonné : les bravos, le badge, et évidemment la
grille des autres membres.

Le badge est propre à chaque salon (`labels[salonId]` sur le doc user, avec le
champ `label` en repli puis l'emoji animal). La même personne peut donc être
« MI » dans un salon et rester 🐆 dans un autre — les notifications push suivent,
chaque salon lisant le badge qu'il affiche.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

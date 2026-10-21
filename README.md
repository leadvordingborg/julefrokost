# Julefrokost – fælles madliste 🎄

Denne version er **klar til upload til GitHub**. Firebase-konfigurationen i `app.js` og arrangørens e-mail i `firestore.rules` er udfyldt.

## Hvad er sat op?

- Firebase-projekt: `julefrokost-30e8d`
- Arrangør: `Alexander.madsen@me.com`
- Firestore-samling: `contributions`
- Gæster kan tilføje retter med obligatorisk navn uden login.
- Kun arrangøren kan slette tilmeldinger efter login.
- Listen opdateres live på alle enheder.

## Firebase

Du har allerede oprettet Cloud Firestore, slået Email/Password-login til og publiceret reglerne. `firestore.rules` er en kopi af de tilsigtede regler med din e-mail udfyldt. Hvis du vil sammenligne eller opdatere dem, gør du det i Firebase Console → Firestore → Rules. **Upload af `firestore.rules` til GitHub aktiverer ikke reglerne automatisk.**

## Udgiv på GitHub Pages

1. Åbn repository `leadvordingborg/julefrokost` på GitHub.
2. Vælg **Add file → Upload files**.
3. Upload filerne `index.html`, `styles.css`, `app.js`, `firestore.rules` og `README.md` **direkte i roden** af repository'et (ikke ZIP-filen eller en ekstra mappe).
4. Klik **Commit changes**.
5. Gå til **Settings → Pages** og vælg **Deploy from a branch**, **main**, **/(root)**. Gem.
6. Når publiceringen er færdig, forventes adressen at være https://leadvordingborg.github.io/julefrokost/

## Test før du deler linket

1. Åbn hjemmesiden i et privat/inkognito-vindue.
2. Vælg en ret, skriv et navn, og tilmeld. Bekræft at navnet vises ved retten.
3. Åbn siden på en anden enhed, og bekræft at retten vises.
4. Log ind som arrangør med din Firebase Authentication-konto, og test at du kan slette testtilmeldingen.
5. Bekræft at en gæst uden login **ikke** ser sletteknappen.

## Bemærkninger

- Hjemmesidens kode er offentlig via GitHub Pages, og tilmeldinger kan læses af alle, som har adgang til databasen via hjemmesiden. Del ikke følsomme oplysninger.
- Firebase-webkonfigurationens `apiKey` er en offentlig klientnøgle, ikke en administratoradgangskode. Del aldrig din Firebase-adgangskode eller service account-nøgler.
- Alle kan i princippet tilføje tilmeldinger; den offentlige formular er ikke beskyttet mod spam.
- Gæster kan ikke selv ændre/slette tilmeldinger; arrangøren kan slette dem.
- Forudbestemte retter kan ændres i `defaultDishes` i `app.js`.


## Opdateret madliste (oktober 2026)

- Alle forslag vises under **Forslag til retter** og er **ikke** tilmeldinger.
- Aftalerne fra familietråden importeres ved at logge ind som arrangør og klikke **🎄 Indlæs aftalte retter**. Det er kun nødvendigt én gang. Gentagne klik springer allerede importerede poster over.
- Før importen er madlisten tom (medmindre der allerede er registreret tilmeldinger).
- Drikkevarer er ikke en tilmeldingsret: Alle medbringer selv drikkevarer.
- Fiskefilet med tilbehør er samlet under Søren; brød og smør er registreret separat på Jonas.
- Vigtigt: Filerne skal uploades til GitHub som erstatning for de gamle. Der er ikke behov for at ændre Firestore-reglerne.
- Arrangørens sletteknap kan fjerne både importerede og almindelige tilmeldinger. Genimport genskaber slettede importerede retter; undlad derfor at bruge importknappen igen efter manuel oprydning.


## Rettelse af importknappen
Importen viser nu status og konkrete Firebase-fejl direkte under knappen. Den bruger samme `addDoc`-oprettelse som gæsternes tilmeldinger og springer allerede tilmeldte kombinationer af navn og ret over. Upload alle filerne og vent på GitHub Pages-udrulningen; opdater eventuelt med Ctrl+F5.


## Opdatering: forslag og gruppering
- Når en ret tilmeldes, forsvinder den fra forslag og rullemenu for alle, når Firestore synkroniserer.
- Madlisten er grupperet alfabetisk efter person, med alle personens retter i samme kort.
- Administrator kan stadig slette hver enkelt ret; så dukker forslaget op igen, hvis det findes i forslagslisten.
- Fiskefilet med tilbehør dækker forslagene fiskefilet, remoulade og citron; rejer med tilbehør dækker rejer; brød dækker rugbrød og franskbrød som forslag.
- Eksisterende Firebase-data bevares. Dette er en visnings- og brugerfladeændring; Firestore-reglerne behøver ikke ændres.
- Bemærk: To personer, der tilmelder sig samtidigt, kan stadig nå at vælge samme ret. En helt hård unikhedsgaranti kræver servervalidering.

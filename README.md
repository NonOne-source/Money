# World Empire V6 – Konten, Handel und iPad

Diese Änderung setzt die gewünschten Punkte 1, 7, 10, 12, 21 und 22 um.

- Spielerkarte öffnen: kompletter Besitz, Häuser/Hotels, Hypotheken, Aktien, Bargeld, Vermögen und erhaltene/gezahlte Miete.
- Handelsfenster: Grundstücke nach Gruppen sortiert, eigene Gruppenfarben (auch bei eigenen Stadtvorlagen), Besitzerfarbe separat beim Spielernamen. Bebaute Gruppen sind gesperrt.
- Handelsvergleich: Buchwerte einschließlich Bargeld und Hypotheken, neu vervollständigte/aufgelöste Gruppen auf beiden Seiten. Kein behaupteter Marktpreis.
- Auktionen: +10, +50 und +100 relativ zum aktuellen Höchstgebot bzw. Startgebot. Die Schnellwahl setzt nur den Eingabebetrag; erst „Verbindlich bieten“ sendet ihn.
- Schuldenhilfe: anhand der tatsächlichen Regeln geprüfte Vorschläge für Aktienverkauf, gleichmäßigen Gebäudeabbau und Hypotheken. Jeder Schritt wird einzeln ausgelöst; nichts wird automatisch verkauft.
- iPad: die Gesamtansicht richtet sich nach der Bildschirmhöhe, maximal 680 CSS-Pixel Breite. Vergrößerung auf 150/200 % bleibt verfügbar. Gilt für beide Bretter.

## Konten

Benutzername (3–20 Buchstaben/Ziffern/Unterstrich, ohne Unterscheidung der Großschreibung) und Passwort (12–128 Zeichen). Ein Konto ist freiwillig. Die Registrierung übernimmt ein vorhandenes V5-Profil nach Nachweis des bisherigen Anmeldecodes; dessen ID, Freunde und Online-Statistik bleiben erhalten. Lokale Gast-Karriere bleibt lokal und wird nicht als verifizierte Serverstatistik importiert.

Scrypt-Passworthashes mit individuellen zufälligen Salts (N=16384, r=8, p=5), serverseitige Sitzungen und HttpOnly/SameSite-Cookies. Auf HTTPS werden Secure-Cookies gesetzt. Begrenzte Anmeldeversuche; Passwortwechsel/-Reset beendet andere Sitzungen. Öffentliche Profilantworten enthalten keine Passwörter, Hashes oder E-Mail-Adressen. Der bisherige private Code wird nach einer Migration als Zugang abgeschaltet.

Avatar und Anzeigename lassen sich bearbeiten. Der Benutzername bleibt der eindeutige Anmeldename. Google-Konten bekommen einen eindeutigen technischen Benutzernamen und den Google-Anzeigenamen. Es gibt absichtlich keine automatische Verknüpfung vorhandener Konten allein aufgrund gleicher E-Mail-Adressen.

## Veröffentlichen

Im Hauptverzeichnis bleiben `worker.js` (komplette App + Server) und `wrangler.json` die Deployment-Dateien. `source/` dient zur weiteren Entwicklung.

Beide Dateien gemeinsam aktualisieren. `wrangler.json` aktiviert jetzt `nodejs_compat` für die Passwortableitung. Workername und vorhandene Durable-Object-Migrationen bleiben erhalten. Keine neue Datenbankbindung nötig. Authentifizierung verwendet einen separaten Durable Object innerhalb derselben Namespace-Bindung; bestehende Räume bleiben in ihren eigenen Objekten.

Build-Befehl für den fertigen Root-Worker leer lassen; Deploy-Befehl:

```sh
npx --yes wrangler@4.135.0 deploy
```

Ein Merge in den mit Cloudflare verbundenen Produktionsbranch kann ein Deployment auslösen. Dieser Änderungsvorschlag wurde lokal geprüft, nicht auf Cloudflare veröffentlicht. Alte aktive Partien vor einem Update möglichst beenden.

## Google-Anmeldung aktivieren

Ohne diese Einstellungen bleibt Google im UI ausdrücklich als noch nicht verfügbar markiert. Benutzername/Passwort und Gastmodus funktionieren unabhängig davon.

1. Im Google-Cloud-Projekt einen OAuth-Client vom Typ Webanwendung und den Consent-Screen einrichten.
2. Als erlaubte Weiterleitungsadresse exakt `https://DEINE-SPIEL-DOMAIN/api/auth/google/callback` eintragen.
3. `GOOGLE_CLIENT_ID` und `GOOGLE_CLIENT_SECRET` in den Worker-Einstellungen setzen. Das Secret als verschlüsseltes Secret speichern, niemals ins Repository schreiben.
4. Bei OAuth-Testbetrieb zugelassene Testnutzer im Google-Projekt konfigurieren; für allgemeinen Zugriff den dafür vorgesehenen Veröffentlichungsprozess abschließen.

Der Code nutzt Authorization Code + PKCE, einen einmaligen, zehn Minuten gültigen State, einen HttpOnly-State-Cookie und das Google-Userinfo-Endpunkt mit verifiziertem E-Mail-Status. Echte Anmeldung mit einem Google-Konto ist noch nicht getestet, da keine OAuth-Zugangsdaten vorliegen.

Google-Dokumentation: https://developers.google.com/identity/openid-connect/openid-connect

## Optionale E-Mail-Wiederherstellung aktivieren

Die Mailanbindung ist für Resend implementiert. Benötigt werden ein eigener Maildienst-Zugang und ein zugelassener Absender. Es wurden keine externen E-Mails während der Entwicklung verschickt.

- `RESEND_API_KEY`: als verschlüsseltes Worker-Secret setzen.
- `MAIL_FROM`: zugelassener Absender, z. B. `World Empire <spiel@deine-domain.de>`.

Ohne diese Einstellungen zeigt die Oberfläche, dass Mailversand noch nicht aktiviert ist. Eine bei der Registrierung hinterlegte E-Mail bleibt dann unbestätigt; sie erlaubt noch keinen Passwort-Reset. Nach Aktivierung kann über „E-Mail ändern / bestätigen“ eine Bestätigung angefordert werden.

Bestätigungs- und Reset-Links sind 15 Minuten gültig, einmal verwendbar und serverseitig nur gehasht gespeichert. Die Token werden im URL-Fragment übertragen, nicht als normale Server-Query. Nur bestätigte Adressen erhalten Reset-Mails. Ein unbekannter Benutzer erhält dieselbe neutrale Antwort wie ein bekannter Benutzer. Ohne bestätigte E-Mail bzw. Google-Zugang gibt es keine automatische Wiederherstellung eines vergessenen Passworts.

## Entwickeln und prüfen

```sh
cd source
npm ci
npm test
npm run build:release
```

Der Build schreibt nach `source/release/`. Zum Veröffentlichen dessen `worker.js` und `wrangler.json` ins Hauptverzeichnis kopieren.

```sh
npx wrangler dev --config release/wrangler.json --port 8798
# Zweites Terminal in source:
TEST_API=http://127.0.0.1:8798 npm run test:multiplayer
```

Die automatisch ausgeführten Prüfungen umfassen 54 Regel-/Beratungstests, zwei Authentifizierungsabläufe mit simulierten Google-/Mailantworten sowie sieben lokale Server-/WebSocket-Integrationstests. Browserprüfung: Registrierung, Cookie-Sitzung im Multiplayer, Handelsfarben, Gruppenvergleich, Besitzdialog, Schuldenhilfe, Schnellgebote, iPad-Hoch-/Querformat. Kein Test auf physischem iPad/Safari und kein Produktions-Lasttest.

Lizenzhinweise stehen in `source/LICENSES.txt` und im gebündelten Worker.

export default function InfoTab() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-slate-300">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold text-white">Wie „offline“ funktioniert das hier wirklich?</h2>
        <p className="mt-3">
          Diese App ist so gebaut, dass eine Internetverbindung <span className="text-white">nur genau einmal</span>{" "}
          gebraucht wird: um Sprachpakete (Texterkennung) und Übersetzungsmodelle herunterzuladen. Danach laufen
          Scan und Übersetzung komplett auf dem Gerät — es wird kein Bild und kein Text irgendwohin gesendet.
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="font-semibold text-white">Technischer Hintergrund</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Die React-Oberfläche und die API-Schicht der Bibliotheken sind fest in die APK eingebaut. Es wird
            dafür <span className="text-white">kein Programmcode aus dem Internet nachgeladen</span>.
          </li>
          <li>
            Der eigentliche Erkennungs-„Motor“ (Tesseract-WASM-Kerne) sowie die KI-Übersetzungs-Bibliothek sind
            mit mehreren MB zu groß, um sie in ein einzelnes HTML-Bundle einzubetten — sie werden daher wie die
            Sprach- und Modelldaten einmalig geladen und danach vom Gerät automatisch zwischengespeichert
            (Browser-Cache bzw. IndexedDB/Cache-Storage).
          </li>
          <li>
            Die eigentlichen <span className="text-white">Daten</span> — OCR-Sprachpakete (ein paar MB je
            Sprache) und KI-Übersetzungsmodelle (60–600 MB je nach Modell) — werden ebenfalls beim ersten
            Gebrauch heruntergeladen, weil sie zu groß sind, um sie fest in die APK einzubauen.
          </li>
          <li>
            Diese Daten werden danach dauerhaft auf dem Gerät gespeichert. Ein erneuter Download ist nur nötig,
            wenn die App-Daten gelöscht werden oder ein neues Sprachpaket/Modell gewählt wird.
          </li>
          <li>
            Im Tab „Modelle“ kannst du alle benötigten Sprachen/Modelle vorab herunterladen, während du WLAN hast
            — danach kannst du in den Flugmodus wechseln und die App funktioniert weiterhin.
          </li>
          <li className="text-amber-200/90">
            Empfehlung für die echte APK: Für eine 100%-Garantie (auch beim allerersten Start ohne jedes Internet
            außer für die reinen Modelldaten) sollten die Tesseract- und Transformers.js-Motor-Dateien zusätzlich
            als lokale Dateien im <code>public/</code>-Ordner des Projekts mitgeliefert werden, statt sie von
            einem CDN zu laden. Das ist rein eine Fleißaufgabe (Dateien kopieren, Pfade anpassen) und kein
            grundsätzliches Problem des Ansatzes hier.
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
        <h3 className="font-semibold text-amber-200">Wichtiger Hinweis zum Testen</h3>
        <p className="mt-2 text-amber-100/90">
          Teste den Offline-Betrieb am besten so: Öffne den Tab „Modelle“, lade dort einmal alle benötigten
          Sprachen/Modelle herunter, aktiviere danach den Flugmodus und probiere Scan + Übersetzung erneut aus.
          Nur so lässt sich zuverlässig prüfen, ob wirklich keine Internetverbindung mehr nötig ist.
        </p>
      </section>
    </div>
  );
}

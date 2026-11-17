# Additional JAM instruments — 2026-11-18

Only new JAM files were created from a read-only licensed local archive. The five
original catalog entries, their 58 audio files and the first 58 provenance entries
are unchanged. No WAVE resource, project or source sample was modified.

| JAM instrument | Recording source | License |
| --- | --- | --- |
| Clean electric guitar | [FreePats FSBS Electric Guitar Clean #1, small edition](https://freepats.zenvoid.org/ElectricGuitar/clean-electric-guitar.html) | CC0-1.0 |
| Flute | [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE), Versilian Studios; recorded by Sam Gossner and Simon Dalzell | CC0-1.0 |
| Violin | [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE), Versilian Studios; recorded by Sam Gossner and Simon Dalzell | CC0-1.0 |

The CC0 legal text is included in `CC0-1.0.txt`. The recording source and SHA256 of
each input and output appear in `sample-provenance.json`. The FreePats source page
and [VSCO license](https://github.com/sgossner/VSCO-2-CE/blob/master/LICENSE) were
checked on 2026-11-18. No third-party code or artwork was imported.

The electric guitar's Ogg bytes were copied unchanged. New sample gain metadata
limits pre-instrument peaks to 0.7; the existing instrument, voice, volume and
limiter stages still apply. Flute and violin were converted to 32 kHz mono 16-bit
PCM with a phase-matched 60 ms loop crossfade. Their legacy archive used root
labels one octave below the measured recording pitch: new JAM metadata adds 12
semitones to those root labels. Small root-tuning corrections use waveform-period
measurements. Source files and the existing JAM instruments were not retuned.

The new sampler supports MIDI, keyboard and mouse through the existing engine.
The additional item-use exports still require a successful inventory-use callback
and operator-provided item definitions. No inventory resource or item data is added
or modified by this sample pack.
Local PCM and WebAudio results are not evidence of actual FiveM sound or timbre.

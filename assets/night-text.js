(function (window) {
    'use strict';

    var messages = {
        en: {
            enabled: 'Black out the display at night',
            start: 'Start time',
            end: 'End time',
            hint: 'Times follow this device’s clock. For an overnight schedule, choose an evening start and a morning end.',
            invalid: 'Choose two different, valid times or turn off the night display, then save.',
            invalidSaved: 'The night schedule is incomplete or invalid. Choose two different, valid times or leave the night display off, then save.'
        },
        nl: {
            enabled: 'Scherm ’s nachts zwart maken',
            start: 'Begintijd',
            end: 'Eindtijd',
            hint: 'De tijden volgen de klok van dit apparaat. Kies voor een nachtschema een begintijd in de avond en een eindtijd in de ochtend.',
            invalid: 'Kies twee verschillende, geldige tijden of zet de nachtweergave uit en sla de instellingen op.',
            invalidSaved: 'Het nachtschema is onvolledig of ongeldig. Kies twee verschillende, geldige tijden of laat de nachtweergave uit en sla de instellingen op.'
        },
        fr: {
            enabled: 'Mettre l’écran au noir la nuit',
            start: 'Heure de début',
            end: 'Heure de fin',
            hint: 'Les horaires suivent l’horloge de cet appareil. Pour couvrir toute la nuit, choisissez une heure de début le soir et une heure de fin le matin.',
            invalid: 'Choisissez deux heures valides et différentes ou désactivez l’écran noir, puis enregistrez.',
            invalidSaved: 'Les horaires de nuit sont incomplets ou non valides. Choisissez deux heures valides et différentes ou laissez l’écran noir désactivé, puis enregistrez.'
        },
        de: {
            enabled: 'Bildschirm nachts schwarz schalten',
            start: 'Startzeit',
            end: 'Endzeit',
            hint: 'Die Zeiten richten sich nach der Uhr dieses Geräts. Für einen Zeitraum über Nacht wähle eine Startzeit am Abend und eine Endzeit am Morgen.',
            invalid: 'Wähle zwei unterschiedliche, gültige Uhrzeiten oder schalte die Nachtanzeige aus. Speichere dann die Einstellungen.',
            invalidSaved: 'Der Nachtzeitplan ist unvollständig oder ungültig. Wähle zwei unterschiedliche, gültige Uhrzeiten oder lass die Nachtanzeige ausgeschaltet. Speichere dann die Einstellungen.'
        },
        es: {
            enabled: 'Poner la pantalla en negro por la noche',
            start: 'Hora de inicio',
            end: 'Hora de fin',
            hint: 'Las horas siguen el reloj de este dispositivo. Para cubrir la noche, elige una hora de inicio por la tarde o la noche y una de fin por la mañana.',
            invalid: 'Elige dos horas válidas y distintas o desactiva la pantalla nocturna. Luego guarda los ajustes.',
            invalidSaved: 'El horario nocturno está incompleto o no es válido. Elige dos horas válidas y distintas o deja desactivada la pantalla nocturna. Luego guarda los ajustes.'
        },
        it: {
            enabled: 'Mostra uno schermo nero di notte',
            start: 'Ora di inizio',
            end: 'Ora di fine',
            hint: 'Gli orari seguono l’orologio di questo dispositivo. Per coprire tutta la notte, scegli un orario di inizio serale e uno di fine mattutino.',
            invalid: 'Scegli due orari validi e diversi o disattiva lo schermo nero notturno, poi salva.',
            invalidSaved: 'L’orario notturno è incompleto o non valido. Scegli due orari validi e diversi o lascia disattivato lo schermo nero notturno, poi salva.'
        },
        'pt-BR': {
            enabled: 'Deixar a tela preta à noite',
            start: 'Hora de início',
            end: 'Hora de fim',
            hint: 'Os horários seguem o relógio deste dispositivo. Para cobrir a noite, escolha um horário de início à noite e um de término pela manhã.',
            invalid: 'Escolha dois horários válidos e diferentes ou desative a tela noturna. Depois, salve os ajustes.',
            invalidSaved: 'O horário noturno está incompleto ou inválido. Escolha dois horários válidos e diferentes ou mantenha a tela noturna desativada. Depois, salve os ajustes.'
        }
    };

    window.BirdWeatherNightText = {
        message: function (locale, key) {
            return window.BirdWeatherText.resolveMessage(messages, locale, key);
        }
    };
}(window));

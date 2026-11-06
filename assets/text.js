(function (window) {
    'use strict';

    var messages = {
        en: {
            title: 'BirdWeather Painting',
            loading: 'Listening for birds',
            missingStation: 'Choose a station',
            missingStationDetail: 'Open this page with a BirdWeather station ID in the address, for example {example}.',
            invalidStation: 'Check the station ID',
            invalidStationDetail: 'Use the numeric ID of a public BirdWeather station, for example {example}.',
            emptyDay: 'No birds heard today',
            emptyDetail: 'This station has no detections to show yet. The page will check again automatically.',
            older: 'Older detection. No birds heard today.',
            observed: 'Heard on {time} ({zone})',
            connectionTitle: 'Waiting for BirdWeather',
            unavailable: 'Couldn’t reach BirdWeather. Check your connection. The page will try again automatically.',
            paused: 'Refresh paused while this page is hidden.',
            refreshing: 'Checking BirdWeather…',
            datePattern: '{month}/{day}/{year}, {hour}:{minute}'
        },
        nl: {
            title: 'BirdWeather Schilderij',
            loading: 'We luisteren naar vogels',
            missingStation: 'Kies een station',
            missingStationDetail: 'Open deze pagina met een BirdWeather-station-ID in het adres, bijvoorbeeld {example}.',
            invalidStation: 'Controleer de station-ID',
            invalidStationDetail: 'Gebruik de numerieke ID van een openbaar BirdWeather-station, bijvoorbeeld {example}.',
            emptyDay: 'Vandaag geen vogels gehoord',
            emptyDetail: 'Dit station heeft nog geen waarnemingen om te tonen. De pagina controleert dit automatisch opnieuw.',
            older: 'Eerdere waarneming. Vandaag zijn er geen vogels gehoord.',
            observed: 'Gehoord op {time} ({zone})',
            connectionTitle: 'We wachten op BirdWeather',
            unavailable: 'BirdWeather is onbereikbaar. Controleer je verbinding. De pagina probeert het automatisch opnieuw.',
            paused: 'Vernieuwen is gepauzeerd zolang deze pagina verborgen is.',
            refreshing: 'BirdWeather wordt geraadpleegd…',
            datePattern: '{day}-{month}-{year}, {hour}:{minute}'
        },
        fr: {
            title: 'Tableau BirdWeather',
            loading: 'À l’écoute des oiseaux',
            missingStation: 'Choisissez une station',
            missingStationDetail: 'Ouvrez cette page avec un identifiant de station BirdWeather dans l’adresse, par exemple {example}.',
            invalidStation: 'Vérifiez l’identifiant de la station',
            invalidStationDetail: 'Utilisez l’identifiant numérique d’une station BirdWeather publique, par exemple {example}.',
            emptyDay: 'Aucun oiseau entendu aujourd’hui',
            emptyDetail: 'Cette station n’a encore aucune détection à afficher. La page vérifiera automatiquement de nouveau.',
            older: 'Détection ancienne. Aucun oiseau entendu aujourd’hui.',
            observed: 'Entendu le {time} ({zone})',
            connectionTitle: 'En attente de BirdWeather',
            unavailable: 'BirdWeather est inaccessible. Vérifiez votre connexion. La page réessaiera automatiquement.',
            paused: 'L’actualisation est suspendue tant que cette page est masquée.',
            refreshing: 'Consultation de BirdWeather…',
            datePattern: '{day}/{month}/{year} à {hour}:{minute}'
        },
        de: {
            title: 'BirdWeather-Gemälde',
            loading: 'Wir lauschen nach Vögeln',
            missingStation: 'Station auswählen',
            missingStationDetail: 'Öffne diese Seite mit einer BirdWeather-Stations-ID in der Adresse, zum Beispiel {example}.',
            invalidStation: 'Stations-ID prüfen',
            invalidStationDetail: 'Verwende die numerische ID einer öffentlichen BirdWeather-Station, zum Beispiel {example}.',
            emptyDay: 'Heute wurden keine Vögel gehört',
            emptyDetail: 'Für diese Station liegen noch keine Erkennungen vor. Die Seite prüft das automatisch erneut.',
            older: 'Ältere Erkennung. Heute wurden keine Vögel gehört.',
            observed: 'Gehört am {time} ({zone})',
            connectionTitle: 'Warten auf BirdWeather',
            unavailable: 'BirdWeather ist nicht erreichbar. Prüfe deine Verbindung. Die Seite versucht es automatisch erneut.',
            paused: 'Die Aktualisierung pausiert, solange diese Seite ausgeblendet ist.',
            refreshing: 'BirdWeather wird abgefragt…',
            datePattern: '{day}.{month}.{year}, {hour}:{minute}'
        },
        es: {
            title: 'Cuadro de BirdWeather',
            loading: 'A la escucha de las aves',
            missingStation: 'Elige una estación',
            missingStationDetail: 'Abre esta página con el identificador de una estación de BirdWeather en la dirección, por ejemplo {example}.',
            invalidStation: 'Revisa el identificador de la estación',
            invalidStationDetail: 'Usa el identificador numérico de una estación pública de BirdWeather, por ejemplo {example}.',
            emptyDay: 'Hoy no se han oído aves',
            emptyDetail: 'Esta estación aún no tiene detecciones para mostrar. La página volverá a comprobarlo automáticamente.',
            older: 'Detección anterior. Hoy no se han oído aves.',
            observed: 'Se oyó el {time} ({zone})',
            connectionTitle: 'A la espera de BirdWeather',
            unavailable: 'No se pudo conectar con BirdWeather. Revisa tu conexión. La página volverá a intentarlo automáticamente.',
            paused: 'La actualización está en pausa mientras esta página está oculta.',
            refreshing: 'Consultando BirdWeather…',
            datePattern: '{day}/{month}/{year}, {hour}:{minute}'
        },
        it: {
            title: 'Quadro BirdWeather',
            loading: 'In ascolto degli uccelli',
            missingStation: 'Scegli una stazione',
            missingStationDetail: 'Apri questa pagina con l’ID di una stazione BirdWeather nell’indirizzo, ad esempio {example}.',
            invalidStation: 'Controlla l’ID della stazione',
            invalidStationDetail: 'Usa l’ID numerico di una stazione BirdWeather pubblica, ad esempio {example}.',
            emptyDay: 'Oggi non si sono sentiti uccelli',
            emptyDetail: 'Questa stazione non ha ancora rilevamenti da mostrare. La pagina controllerà di nuovo automaticamente.',
            older: 'Rilevamento precedente. Oggi non si sono sentiti uccelli.',
            observed: 'Sentito il {time} ({zone})',
            connectionTitle: 'In attesa di BirdWeather',
            unavailable: 'Impossibile raggiungere BirdWeather. Controlla la connessione. La pagina riproverà automaticamente.',
            paused: 'L’aggiornamento è in pausa finché questa pagina è nascosta.',
            refreshing: 'Consultazione di BirdWeather…',
            datePattern: '{day}/{month}/{year}, {hour}:{minute}'
        },
        'pt-BR': {
            title: 'Quadro BirdWeather',
            loading: 'À escuta das aves',
            missingStation: 'Escolha uma estação',
            missingStationDetail: 'Abra esta página com o ID de uma estação do BirdWeather no endereço, por exemplo {example}.',
            invalidStation: 'Confira o ID da estação',
            invalidStationDetail: 'Use o ID numérico de uma estação pública do BirdWeather, por exemplo {example}.',
            emptyDay: 'Nenhuma ave ouvida hoje',
            emptyDetail: 'Esta estação ainda não tem detecções para mostrar. A página vai verificar de novo automaticamente.',
            older: 'Detecção anterior. Nenhuma ave foi ouvida hoje.',
            observed: 'Ouvida em {time} ({zone})',
            connectionTitle: 'Aguardando o BirdWeather',
            unavailable: 'Não foi possível acessar o BirdWeather. Confira sua conexão. A página vai tentar de novo automaticamente.',
            paused: 'A atualização fica pausada enquanto esta página estiver oculta.',
            refreshing: 'Consultando o BirdWeather…',
            datePattern: '{day}/{month}/{year}, {hour}:{minute}'
        }
    };

    function localeFor(preferences) {
        for (var index = 0; index < preferences.length; index += 1) {
            var preference = preferences[index].toLowerCase();
            if (preference === 'pt-br' || preference === 'pt') {
                return 'pt-BR';
            }
            var language = preference.split('-')[0];
            if (Object.prototype.hasOwnProperty.call(messages, language)) {
                return language;
            }
        }
        return 'en';
    }

    function formatDate(locale, observation) {
        if (window.Intl && window.Intl.DateTimeFormat) {
            // The API includes the station's UTC offset at the time of detection.
            return new window.Intl.DateTimeFormat(locale, {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
            }).format(new Date(observation.time + observation.offsetMinutes * 60000));
        }

        // iOS 9 lacks Intl, so retain the reported time and format the numeric date locally.
        return message(locale, 'datePattern', {
            year: observation.timestamp.slice(0, 4),
            month: observation.timestamp.slice(5, 7),
            day: observation.timestamp.slice(8, 10),
            hour: observation.timestamp.slice(11, 13),
            minute: observation.timestamp.slice(14, 16)
        });
    }

    function message(locale, key, fields) {
        return ((messages[locale] || messages.en)[key] || messages.en[key]).replace(/\{(\w+)\}/g, function (placeholder, name) {
            return fields && Object.prototype.hasOwnProperty.call(fields, name) ? fields[name] : placeholder;
        });
    }

    window.BirdWeatherText = {
        localeFor: localeFor,
        formatDate: formatDate,
        message: message
    };
}(window));

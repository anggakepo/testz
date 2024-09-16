const games = {
    1: {
        name: 'Riding Extreme 3D',
        appToken: 'd28721be-fd2d-4b45-869e-9f253b554e50',
        promoId: '43e35910-c168-4634-ad4f-52fd764a843f',
        interval: 20,
        eventCount: 13,
    },
    2: {
        name: 'Chain Cube 2048',
        appToken: 'd1690a07-3780-4068-810f-9b5bbf2931b2',
        promoId: 'b4170868-cef0-424f-8eb9-be0622e8e8e3',
        interval: 20,
        eventCount: 3,
    },
    3: {
        name: 'My Clone Army',
        appToken: '74ee0b5b-775e-4bee-974f-63e7f4d5bacb',
        promoId: 'fe693b26-b342-4159-8808-15e3ff7f8767',
        interval: 120,
        eventCount: 5,
    },
    4: {
        name: 'Train Miner',
        appToken: '82647f43-3f87-402d-88dd-09a90025313f',
        promoId: 'c4480ac7-e178-4973-8061-9ed5b2e17954',
        interval: 120,
        eventCount: 1,
    }
    // You can add more games if you have more
};

function generateClientId() {
    return crypto.randomUUID();
}

async function loginClient(gameNumber) {
    const clientId = generateClientId();
    const url = 'https://api.gamepromo.io/promo/login-client';

    const data = {
        appToken: games[gameNumber].appToken,
        clientId: clientId,
        clientOrigin: 'deviceid'
    };

    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
    };

    try {
        const response = await fetch(url, {
            signal: AbortSignal.timeout(5000),
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data)
        });
        const result = await response.json();

        if (result.error_code === 'TooManyIpRequest') {
            return 'TooManyIpRequest';
        }
        return result.clientToken;
    } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return loginClient(gameNumber);
    }
}

async function registerEvent(token, gameNumber) {
    await new Promise(resolve => setTimeout(resolve, games[gameNumber].interval * 1000));
    const eventId = generateRandomUUID();
    const url = 'https://api.gamepromo.io/promo/register-event';
    const data = {
        promoId: games[gameNumber].promoId,
        eventId: eventId,
        eventOrigin: 'undefined'
    };
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
    };
    try {
        const response = await fetch(url, {
            signal: AbortSignal.timeout(5000),
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!result.hasCode) {
            console.log('Retry register event');
            return registerEvent(token, gameNumber);
        } else {
            return token;
        }
    } catch (error) {
        console.error('Fatal error:', error.message);
        await new Promise(resolve => setTimeout(resolve, 5000));
        let newToken = await loginClient(gameNumber);
        if (newToken === 'TooManyIpRequest') {
            throw new Error('Too many requests, try again in 10 minutes')
        }
        return registerEvent(newToken, gameNumber);
    }
}

async function createCode(token, gameNumber) {
    let response;
    do {
        try {
            await new Promise(resolve => setTimeout(resolve, 1000))
            const url = 'https://api.gamepromo.io/promo/create-code';

            const data = {
                promoId: games[gameNumber].promoId
            };

            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json; charset=utf-8',
            };
            response = await fetch(url, {
                signal: AbortSignal.timeout(5000),
                method: 'POST',
                headers: headers,
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.promoCode) {
                return result.promoCode;
            }

        } catch (error) {
            console.error('Fatal error:', error.message);
        }
    } while (!response || !response.promoCode);
}

function generateRandomUUID() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
        (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
    );
}

const generateButton = document.getElementById('generateButton');
const generateTimeValue = document.getElementById('generate-time-value');
const generateProcessBlock = document.getElementById('process-generate-block');
let keyBlock = document.getElementById('keys-block');
const gameSelect = document.getElementById('game-names-select');

async function generate() {
    generateButton.style.display = 'none';
    gameSelect.disabled = true;
    generateProcessBlock.style.display = 'flex';

    const selectedGame = parseInt(gameSelect.value);

    let eventInterval =  games[selectedGame].interval;
    let eventCount =  games[selectedGame].eventCount;
    const endGenerateTime = Date.now() + (eventInterval * eventCount + 30) * 1000;

    keyBlock.style.display = 'none';

    generateTimeValue.innerText = '⏳';

    let generateTimeInterval = setInterval(() => startProcessGeneration(endGenerateTime), 1000);
    const codes = [];

    await new Promise(resolve => setTimeout(resolve, 5000));

    const tasks = [];

    for (let i = 0; i < 100; i++) { // Changed from 4 to 100 keys
        tasks.push((async (index) => {
            try {
                let token = await loginClient(selectedGame);

                if (token === 'TooManyIpRequest') {
                    throw new Error('Too many requests, try again in 10 minutes')
                }

                let registerToken = await registerEvent(token, selectedGame);
                codes[index] = await createCode(registerToken, selectedGame);
            } catch (error) {
                codes[index] = `Error: ${error.message}`;
            }
        })(i));
    }

    await Promise.all(tasks);

    keyBlock.style.display = 'flex';

    for (let i = 0; i < 100; i++) { // Displaying 100 keys
        let keyValue = document.getElementById('keys-value-' + (i + 1));
        if (keyValue) {
            keyValue.innerText = codes[i];
        } else {
            const newKeyValue = document.createElement('div');
            newKeyValue.id = 'keys-value-' + (i + 1);
            newKeyValue.innerText = codes[i];
            keyBlock.appendChild(newKeyValue);
        }
    }

    generateButton.style.display = 'block';
    gameSelect.disabled = false;
    clearInterval(generateTimeInterval);
    updateGenerateTime(gameSelect)
    console.log(codes);
}

function startProcessGeneration(generationTime) {
    function updateProcessGenerationTime(generationTime) {
        const now = new Date();
        const distance = generationTime - now.getTime();

        generateTimeValue.innerText = printTime(distance)

        if (distance < 0) {
            generateTimeValue.innerText = "⏳";
        }
    }

    updateProcessGenerationTime(generationTime);
}

function printTime(distance) {
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    return '≈ ' +
        String(hours).padStart(2, '0') + ':' +
        String(minutes).padStart(2, '0') + ':' +
        String(seconds).padStart(2, '0');
}

function updateGenerateTime(select) {
    const selectedGame = parseInt(select.value);

    let eventInterval =  games[selectedGame].interval;
    let eventCount =  games[selectedGame].eventCount;

    generateTimeValue.innerText = printTime((eventInterval * eventCount + 30) * 1000)
}

async function copyCode(codeId, button) {
    try {
        let content = '';

        if (codeId === 'all') {
            let codesInput = [];
            for (let i = 0; i < 100; i++) {
                const code = document.getElementById('keys-value-' + (i + 1));
                if (code && code.innerText) {
                    codesInput.push(code.innerText);
                }
            }
            content = codesInput.join('\n');
        } else {
            const code = document.getElementById('keys-value-' + codeId);
            content = code.innerText;
        }

        await navigator.clipboard.writeText(content);

        button.classList.add('check');
        setTimeout(() => button.classList.remove('check'), 1000);
    } catch (err) {
        console.error('Failed to copy: ', err);
    }
}

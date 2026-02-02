const http = require('http');

http.get('http://localhost:3001/api/dorses-summary', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const summary = JSON.parse(data);
            const stok1 = summary.find(s => s.sasi && s.sasi.musteri.includes('Stok 1'));
            if (stok1) {
                console.log('FOUND STOK 1:', JSON.stringify(stok1, null, 2));
            } else {
                console.log('STOK 1 NOT FOUND IN SUMMARY');
                console.log('First 3 items:', JSON.stringify(summary.slice(0, 3), null, 2));
            }
        } catch (e) {
            console.error('Parse Error:', e);
            console.log('Raw Data:', data);
        }
    });
}).on('error', (err) => {
    console.error('Request Error:', err);
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- DORSE DATA ---');
    const dorses = await prisma.dorse.findMany();
    dorses.forEach(d => {
        console.log(`ID: ${d.id}, Musteri: ${d.musteri}`);
        console.log(`  kesimBukum: plazmaProgrami: ${d.plazmaProgrami}, sacMalzemeKontrolu: ${d.sacMalzemeKontrolu}, plazmaKesim: ${d.plazmaKesim}, presBukum: ${d.presBukum}, dorseSasi: ${d.dorseSasi}`);
        console.log(`  onHazirlik: milAltKutuk: ${d.milAltKutuk}, taban: ${d.taban}, yan: ${d.yan}, onGogus: ${d.onGogus}, arkaKapak: ${d.arkaKapak}, yuklemeMalzemesi: ${d.yuklemeMalzemesi}`);
        console.log(`  montaj: dorseKurulmasi: ${d.dorseKurulmasi}, dorseKaynak: ${d.dorseKaynak}, kapakSiperlik: ${d.kapakSiperlik}, yukleme: ${d.yukleme}, hidrolik: ${d.hidrolik}`);
        console.log(`  boya: boyaHazirlik: ${d.boyaHazirlik}, dorseSasiBoyama: ${d.dorseSasiBoyama}`);
        console.log(`  tamamlama: fren: ${d.fren}, dorseElektrik: ${d.dorseElektrik}, tamamlama: ${d.tamamlama}, cekiciElektrik: ${d.cekiciElektrik}, cekiciHidrolik: ${d.cekiciHidrolik}, aracKontrolBypassAyari: ${d.aracKontrolBypassAyari}`);
        console.log(`  akmTseMuayenesi: ${d.akmTseMuayenesi}, dmoMuayenesi: ${d.dmoMuayenesi}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());

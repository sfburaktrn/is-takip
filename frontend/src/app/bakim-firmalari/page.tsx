export default function BakimFirmalariPage() {
    // Firma ekranı artık Bakım Takip içinde sekme olarak yaşıyor.
    // Bu route sadece geriye dönük uyumluluk için, kullanıcıyı doğru sekmeye yönlendirir.
    return (
        <a href="/bakim-takip?view=companies" style={{ display: 'block', padding: 20 }}>
            Bakım Firmaları ekranı taşındı. Devam etmek için tıklayın.
        </a>
    );
}


import { redirect } from 'next/navigation';

/** Eski rota: tam özellikli liste artık Ürün Listesi altında (tüm tipler). */
export default function DamperListesiRedirectPage() {
    redirect('/urun-listesi?type=DAMPER');
}

-- PRIO alanı manuel; varsayılan zorunlu değer kaldırılır (canlı DB güvenli)
ALTER TABLE "SshComplaint" ALTER COLUMN "oncelikPrio" DROP DEFAULT;
ALTER TABLE "SshComplaint" ALTER COLUMN "oncelikPrio" DROP NOT NULL;

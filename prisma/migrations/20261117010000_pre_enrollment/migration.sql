ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'APPLICANT';
CREATE TABLE IF NOT EXISTS school_units (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, "legalName" TEXT NOT NULL,
  cnpj TEXT NOT NULL, "zipCode" TEXT NOT NULL, address TEXT NOT NULL, number TEXT NOT NULL,
  complement TEXT NOT NULL DEFAULT '', neighborhood TEXT NOT NULL, city TEXT NOT NULL, state TEXT NOT NULL,
  phone TEXT NOT NULL, mobile TEXT NOT NULL DEFAULT '', email TEXT NOT NULL, classification TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '', "logoUrl" TEXT NOT NULL DEFAULT '', photos TEXT[] NOT NULL DEFAULT '{}',
  partners JSONB NOT NULL DEFAULT '[]', consultants TEXT[] NOT NULL DEFAULT '{Secretaria,Outro}',
  "isActive" BOOLEAN NOT NULL DEFAULT true, "enrollmentOpen" BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS school_unit_courses (
  "schoolUnitId" TEXT NOT NULL REFERENCES school_units(id) ON DELETE CASCADE,
  "courseId" TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  PRIMARY KEY ("schoolUnitId", "courseId")
);
CREATE TABLE IF NOT EXISTS pre_enrollments (
  id TEXT PRIMARY KEY, "requestId" TEXT NOT NULL UNIQUE, protocol TEXT NOT NULL UNIQUE,
  "applicantId" TEXT NOT NULL REFERENCES users(id), "schoolUnitId" TEXT NOT NULL REFERENCES school_units(id),
  "courseId" TEXT NOT NULL REFERENCES courses(id), "studentId" TEXT REFERENCES users(id),
  "studentCpf" TEXT NOT NULL, "studentName" TEXT NOT NULL, data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING', feedback TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1,
  "reviewedBy" TEXT, "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("studentCpf", "courseId", "schoolUnitId"),
  CONSTRAINT pre_enrollment_status CHECK (status IN ('PENDING','CORRECTION','APPROVED','REJECTED','ENROLLED'))
);
CREATE INDEX IF NOT EXISTS pre_enrollments_applicant_created ON pre_enrollments("applicantId", "createdAt");
CREATE INDEX IF NOT EXISTS pre_enrollments_status_created ON pre_enrollments(status, "createdAt");
-- Cadastra e associa somente na primeira execução; não reativa escolhas removidas pelo administrador.
WITH initial AS (
  INSERT INTO school_units (id,code,name,"legalName",cnpj,"zipCode",address,number,neighborhood,city,state,phone,email,classification)
  VALUES ('gw-marechal','15','Get Wise Marechal','JM LANGE & CIA LTDA','17378062000134','85960000','Rua Independência','1460','Centro','Marechal Cândido Rondon','PR','4532540789','mcr@getwise.com.br','MEI')
  ON CONFLICT (code) DO NOTHING RETURNING id
)
INSERT INTO school_unit_courses ("schoolUnitId", "courseId") SELECT initial.id, courses.id FROM initial CROSS JOIN courses WHERE courses."isActive" = true ON CONFLICT DO NOTHING;

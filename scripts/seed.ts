import { config as loadEnv } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { services } from "@/lib/db/schema";

loadEnv({ path: [".env.local", ".env"] });

type ServiceSeed = typeof services.$inferInsert;

const SERVICES: ServiceSeed[] = [
  {
    slug: "gov-br",
    name: "Portal gov.br",
    agency: "Governo Federal",
    category: "atendimento",
    sphere: "federal",
    url: "https://www.gov.br/",
    description: "Portal único de serviços digitais do Governo Federal.",
  },
  {
    slug: "receita-federal",
    name: "Receita Federal",
    agency: "Receita Federal do Brasil",
    category: "arrecadacao",
    sphere: "federal",
    url: "https://www.gov.br/receitafederal/pt-br",
    description: "Site institucional e portal de serviços da Receita Federal.",
  },
  {
    slug: "e-cac",
    name: "e-CAC",
    agency: "Receita Federal do Brasil",
    category: "arrecadacao",
    sphere: "federal",
    url: "https://cav.receita.fazenda.gov.br/",
    description: "Centro Virtual de Atendimento ao Contribuinte.",
  },
  {
    slug: "simples-nacional",
    name: "Simples Nacional",
    agency: "Receita Federal do Brasil",
    category: "arrecadacao",
    sphere: "federal",
    url: "https://www8.receita.fazenda.gov.br/SimplesNacional/",
    description: "Portal do regime tributário Simples Nacional.",
  },
  {
    slug: "simei",
    name: "SIMEI",
    agency: "Receita Federal do Brasil",
    category: "arrecadacao",
    sphere: "federal",
    url: "https://www.gov.br/empresas-e-negocios/pt-br/empreendedor",
    description: "Sistema de recolhimento em valores fixos para o MEI.",
  },
  {
    slug: "importa-facil",
    name: "Importa Fácil",
    agency: "Empresa Brasileira de Correios e Telégrafos",
    category: "arrecadacao",
    sphere: "federal",
    url: "https://apps.correios.com.br/portalimportador/",
    description: "Acompanhamento e tributação de remessas postais internacionais.",
  },
  {
    slug: "meu-inss",
    name: "Meu INSS",
    agency: "Instituto Nacional do Seguro Social",
    category: "atendimento",
    sphere: "federal",
    url: "https://meu.inss.gov.br/",
    description: "Portal e app de serviços previdenciários do INSS.",
  },
  {
    slug: "fgts-caixa",
    name: "FGTS",
    agency: "Caixa Econômica Federal",
    category: "atendimento",
    sphere: "federal",
    url: "https://www.fgts.gov.br/",
    description: "Consulta e movimentação do Fundo de Garantia do Tempo de Serviço.",
  },
  {
    slug: "conectesus",
    name: "ConecteSUS",
    agency: "Ministério da Saúde",
    category: "saude",
    sphere: "federal",
    url: "https://conectesus.saude.gov.br/",
    description: "Carteira digital de vacinação e histórico clínico do SUS.",
  },
  {
    slug: "e-sus-aps",
    name: "e-SUS APS",
    agency: "Ministério da Saúde",
    category: "saude",
    sphere: "federal",
    url: "https://sisaps.saude.gov.br/",
    description: "Sistema de informação da Atenção Primária à Saúde.",
  },
  {
    slug: "ctps-digital",
    name: "Carteira de Trabalho Digital",
    agency: "Ministério do Trabalho e Emprego",
    category: "trabalho",
    sphere: "federal",
    url: "https://www.gov.br/trabalho-e-emprego/pt-br/servicos/trabalhador/carteira-de-trabalho-digital",
    description: "Versão digital da CTPS, vinculada ao CPF do trabalhador.",
  },
  {
    slug: "sine",
    name: "Sine",
    agency: "Ministério do Trabalho e Emprego",
    category: "trabalho",
    sphere: "federal",
    url: "https://www.gov.br/trabalho-e-emprego/pt-br/servicos/trabalhador/sine",
    description: "Sistema Nacional de Emprego — intermediação de mão de obra.",
  },
  {
    slug: "agendamento-pf",
    name: "Agendamento Polícia Federal",
    agency: "Polícia Federal",
    category: "documentos",
    sphere: "federal",
    url: "https://www.gov.br/pf/pt-br/assuntos/passaporte",
    description: "Agendamento de passaporte e demais serviços da Polícia Federal.",
  },
  {
    slug: "justica-eleitoral",
    name: "Justiça Eleitoral",
    agency: "Tribunal Superior Eleitoral",
    category: "justica",
    sphere: "federal",
    url: "https://www.tse.jus.br/",
    description: "Portal do TSE — título de eleitor, justificativa e e-Título.",
  },
  {
    slug: "detran-sp",
    name: "Detran-SP",
    agency: "Departamento Estadual de Trânsito de São Paulo",
    category: "documentos",
    sphere: "estadual",
    url: "https://www.detran.sp.gov.br/",
    description: "Serviços de habilitação e veículos do estado de São Paulo.",
  },
  {
    slug: "detran-rj",
    name: "Detran-RJ",
    agency: "Departamento Estadual de Trânsito do Rio de Janeiro",
    category: "documentos",
    sphere: "estadual",
    url: "https://www.detran.rj.gov.br/",
    description: "Serviços de habilitação e veículos do estado do Rio de Janeiro.",
  },
  {
    slug: "detran-mg",
    name: "Detran-MG",
    agency: "Departamento Estadual de Trânsito de Minas Gerais",
    category: "documentos",
    sphere: "estadual",
    url: "https://www.detran.mg.gov.br/",
    description: "Serviços de habilitação e veículos do estado de Minas Gerais.",
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  try {
    await db
      .insert(services)
      .values(SERVICES)
      .onConflictDoUpdate({
        target: services.slug,
        set: {
          name: sql`excluded.name`,
          agency: sql`excluded.agency`,
          category: sql`excluded.category`,
          sphere: sql`excluded.sphere`,
          url: sql`excluded.url`,
          description: sql`excluded.description`,
          active: sql`excluded.active`,
        },
      });
    console.log(`Seeded ${SERVICES.length} services.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

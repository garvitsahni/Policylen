import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5434/policylens?schema=public'

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

export default prisma
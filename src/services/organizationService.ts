
import { prisma } from '../lib/prisma.js';

export async function createOrganization(userId: number, name: string) {
  try {
    if (process.env.NODE_ENV === "development") {
      console.log(`[OrganizationService] Creating organization: ${name} for user ${userId}`)
    }

    // Check if user already has an organization
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { orgId: true }
    })

    if (existingUser?.orgId) {
      // User already has organization, return it
      const existingOrg = await prisma.organization.findUnique({
        where: { id: existingUser.orgId }
      })
      if (existingOrg) {
        if (process.env.NODE_ENV === "development") {
          console.log(`[OrganizationService] User already has organization:`, existingOrg)
        }
        return existingOrg
      }
    }

    const organization = await prisma.organization.create({
      data: {
        name: name.trim(),
      },
    });
    // When org is created, auto-seed standard PH VAT types
    await prisma.vatType.createMany({
      data: [
        { orgId: organization.id, name: 'VAT Inclusive (12%)', rate: 0.12 },
        { orgId: organization.id, name: 'VAT Exempt', rate: 0.0 },
        { orgId: organization.id, name: 'Zero-Rated (0%)', rate: 0.0 },
      ]
    });
    // In your organization creation service, after org is created:

    await prisma.promoType.createMany({
      data: [
        {
          name: 'Senior Citizen',
          description: '20% discount for senior citizens (RA 9994)',
          isActive: true,
          orgId: organization.id,
        },
        {
          name: 'PWD',
          description: '20% discount for persons with disability (RA 10754)',
          isActive: true,
          orgId: organization.id,
        },
        {
          name: 'Employee',
          description: 'Staff/employee discount',
          isActive: true,
          orgId: organization.id,
        },
        {
          name: 'Promo',
          description: 'General promotional discount',
          isActive: true,
          orgId: organization.id,
        },
        {
          name: 'Loyalty',
          description: 'Loyalty card / returning customer discount',
          isActive: true,
          orgId: organization.id,
        },
      ],
      skipDuplicates: true,
    });
    await prisma.user.update({
      where: { id: userId },
      data: {
        orgId: organization.id,
      },
    });

    if (process.env.NODE_ENV === "development") {
      console.log(`[OrganizationService] ✅ Organization created:`, organization)
    }

    return organization;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(`[OrganizationService] ❌ Error creating organization:`, error);
    }
    throw new Error(
      error instanceof Error ? `Organization error: ${error.message}` : 'Failed to create organization'
    );
  }
}

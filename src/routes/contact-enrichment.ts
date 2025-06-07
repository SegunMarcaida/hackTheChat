import { Router, Request, Response } from 'express'
import { createLogger } from '../logger/index.js'
import { Contact, EducationHistory, JobHistory, LinkedInEducation, LinkedInExperience, LinkedInResponse } from '../interfaces.js'
import { db } from '../database/firestore.js'
import { downloadAndUploadImage } from '../utils/download-and-upload-image.js'

const router = Router()
const logger = createLogger('ContactEnrichmentAPI')

// POST /api/contacts/enrich - Enrich contact with LinkedIn data
router.post('/api/contacts/enrich', async (req: Request, res: Response) => {
    try {
        const contactData: Contact = req.body
        console.log('DEBUG: Received contact data:', JSON.stringify(contactData, null, 2))

        if (!contactData) {
            return res.status(400).json({
                success: false,
                error: 'Contact data is required'
            })
        }

        // Check if contact has LinkedIn URL
        if (!contactData.linkedin) {
            return res.status(400).json({
                success: false,
                error: 'Contact must have a LinkedIn URL to be enriched'
            })
        }

        const lastEnrichedAt: any = contactData?.lastEnrichedAt;
        console.log("lastEnrichedAt", lastEnrichedAt);
        let needsEnrichment = true;
        
        if (lastEnrichedAt) {
            const lastEnrichedAtDate = lastEnrichedAt?.toDate();
            const currentDate = new Date();
            const diffTime = Math.abs(currentDate.getTime() - lastEnrichedAtDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            console.log(`Contact was last enriched ${diffDays} days ago`);
            if (diffDays < 30) {
                console.log("Contact was enriched less than 30 days ago");
                needsEnrichment = false;
            }
        }

        logger.info('🔍 API: Contact enrichment requested', {
            contactId: contactData.id,
            linkedinUrl: contactData.linkedin
        })

        if (needsEnrichment) {
            console.log("Contact needs enrichment");
            if (contactData.linkedin) {
                console.log(`Contact has LinkedIn URL: ${contactData.linkedin}`);
                
                // Check if this LinkedIn URL already exists in our database
                console.log("Checking if LinkedIn URL exists in linkedinEnrichmentResponses collection");

                if (!db) {
                    return res.status(500).json({
                        success: false,
                        error: 'Database not initialized'
                    })
                }
                
                const linkedinResponseQuery = await db.collection("linkedinEnrichmentResponses")
                    .where("enrichedData.linkedin", "==", contactData.linkedin)
                    .orderBy("created", "desc")
                    .limit(1)
                    .get();
                
                if (!linkedinResponseQuery.empty) {
                    console.log("Found existing LinkedIn data in collection");
                    const existingData = linkedinResponseQuery.docs[0].data();
                    
                    // Check if the existing data is less than 30 days old
                    const existingDataDate = existingData.created?.toDate();
                    const currentDate = new Date();
                    const diffTime = Math.abs(currentDate.getTime() - existingDataDate.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    console.log(`Existing LinkedIn data is ${diffDays} days old`);
                    
                    if (diffDays < 30 && existingData.linkedInResponse && existingData.enrichedData) {
                        console.log("Using existing LinkedIn data (less than 30 days old) instead of making a new API call");
                        
                        // If we have enriched data with the same LinkedIn URL that's less than 30 days old, merge it
                        // WITHOUT overriding any existing values already present on the contact.
                        const enrichedContact: Contact = { ...contactData } as Contact;

                        // Only copy properties that are missing, null, or empty on the current contact
                        Object.entries(existingData.enrichedData || {}).forEach(([key, value]) => {
                            const currentVal = (enrichedContact as any)[key];
                            const isEmptyString = (
                                typeof currentVal === "string" && currentVal.trim() === "" // empty string
                            ) || (
                                currentVal !== null &&
                                typeof currentVal === "object" &&
                                !Array.isArray(currentVal) &&
                                Object.keys(currentVal).length === 0 // empty object
                            );

                            if (currentVal === undefined || currentVal === null || isEmptyString) {
                                (enrichedContact as any)[key] = value;
                            }
                        });

                        enrichedContact.lastEnrichedAt = new Date();

                        // update the contact data with the enriched data except for the organizationID
                        const { id, ...rest } = enrichedContact;
                        const sanitizedRest = removeUndefinedDeep(rest);
                        await db.collection("contacts").doc(contactData.id).update(sanitizedRest);
                        
                        return enrichedContact;
                    }
                }
                
                // If no existing data found or it was invalid, proceed with normal enrichment
                console.log("No existing LinkedIn data found, proceeding with enrichment");
                const enrichedContact = await enrichLinkedInData(contactData);
                return enrichedContact;
            }
        } else {
            console.log("Contact does not need enrichment");
        }

        // For now, return the contact as is
        res.json({
            success: true,
            data: {
                message: 'Contact enrichment endpoint created',
                contact: contactData
            }
        })
    } catch (error) {
        logger.error('❌ Error enriching contact', error)
        res.status(500).json({
            success: false,
            error: 'Failed to enrich contact'
        })
    }
})


function removeUndefinedDeep<T>(obj: T): T {
    if (Array.isArray(obj)) {
        // @ts-ignore – we know we will return the same type structure
        return obj.map((item) => removeUndefinedDeep(item)) as T;
    } else if (obj && typeof obj === "object" && obj.constructor === Object) {
        const cleaned: Record<string, any> = {};
        Object.entries(obj as Record<string, any>).forEach(([key, value]) => {
            if (value !== undefined) {
                cleaned[key] = removeUndefinedDeep(value);
            }
        });
        // @ts-ignore
        return cleaned as T;
    }
    // primitive value – return as is
    return obj;
}

async function fetchLinkedIn(linkedinUrl: string): Promise<LinkedInResponse> {
    console.log(`Fetching LinkedIn data from URL: ${linkedinUrl}`);
    // Normalize LinkedIn URL to standard format
    // const url = linkedinUrl
    //     .replace(/^(?:https?:\/\/)?(?:www\.)?/, '')
    //     .replace(/\/$/, '');

    // const standardUrl = `https://linkedin.com/${url.startsWith('in/') ? url : `in/${url}`}`;

    const apiUrl = `https://nubela.co/proxycurl/api/v2/linkedin?linkedin_profile_url=${linkedinUrl}`;
    console.log(`Making API request to: ${apiUrl}`);
    const response = await fetch(apiUrl, {
        headers: {
            Authorization: `Bearer ${process.env.PROXYCURL_API_KEY}`
        }
    });
    console.log(`API response status: ${response.status}`);
    const data = await response.json();
    return data;
}


async function saveLinkedInEnrichmentData(
    contactId: string,
   
    linkedInResponse: LinkedInResponse | any,
    enrichedData?: Partial<Contact>
): Promise<void> {
    try {
        console.log(`Saving LinkedIn enrichment data for contact: ${contactId}`);
        if (!db) {
            throw new Error('Database not initialized');
        }
        const docRef = db.collection("linkedinEnrichmentResponses").doc();
        
        // Sanitize before writing to Firestore
        const payload = removeUndefinedDeep({
            id: docRef.id,
            contactId,
            linkedInResponse,
            enrichedData: enrichedData || null,
            created: new Date(),
            profileUrl: linkedInResponse?.profile_url || null,
        });
        
        await docRef.set(payload);
        
        console.log(`Successfully saved LinkedIn enrichment data with ID: ${docRef.id}`);
    } catch (error) {
        console.error("Error saving LinkedIn enrichment data:", error);
        // Don't throw - we don't want to interrupt the main flow if this fails
    }
}

export async function enrichLinkedInData(contactData: Contact): Promise<Contact> {
    console.log("Starting LinkedIn enrichment for contact:", contactData.id, contactData.linkedin);
    try {
        // 1. Call your LinkedIn/People Data Labs API.
        console.log("Fetching LinkedIn data from:", contactData.linkedin);
        const linkedInResponse: LinkedInResponse | any = await fetchLinkedIn(contactData.linkedin as string);

        console.log("linkedInResponse:", JSON.stringify(linkedInResponse, null, 2));

        // Save the LinkedIn response to the new collection regardless of success/failure
        await saveLinkedInEnrichmentData(
            contactData.id,
            linkedInResponse
        );

        if (linkedInResponse?.code === 404 || linkedInResponse?.code === 400) {
            // Person profile doesn't exist
            console.error("Error fetching LinkedIn data:", linkedInResponse.description);
            // await incrementOrgUsage(contactData.organizationID);
            return contactData; // Return original data if LinkedIn profile doesn't exist
        }

        // 2. Extract job history, education, etc. from the response
        console.log("Extracting experiences and education from LinkedIn data");
        const { experiences, education }: { experiences: LinkedInExperience[], education: LinkedInEducation[] } = linkedInResponse;

        // Step A: Figure out which orgs we need to upsert (companies and schools)
        const orgsNeeded: { name: string; type: "company" | "school"; logoUrl?: string }[] = [];

        experiences.forEach((exp) => {
            if (exp.company) {
                orgsNeeded.push({
                    name: exp.company,
                    type: "company",
                    logoUrl: exp.logo_url,
                });
            }
        });
        education.forEach((edu) => {
            if (edu.school) {
                orgsNeeded.push({
                    name: edu.school,
                    type: "school",
                    logoUrl: edu.logo_url,
                });
            }
        });

        // Remove duplicates (by name + type)
        const uniqueOrgsNeeded = [
            ...new Map(
                orgsNeeded.map((item) => [`${item.name}_${item.type}`, item])
            ).values(),
        ];
        console.log("Unique organizations to process:", uniqueOrgsNeeded.length);

        /**
         * We'll keep track of newly upserted or existing org docs in this cache so we can
         * build `jobHistory` and `educationHistory` referencing the correct organizationId.
         */
        const orgCache: Record<string, any> = {};

        // ----------------------------------------------------------------------
        // 3. TRANSACTION: Bulk Upsert Organizations (All Reads, Then All Writes)
        // ----------------------------------------------------------------------
        console.log("Starting transaction to upsert organizations");
        

        // 4. Build jobHistory and educationHistory arrays with references to the upserted orgs
        console.log("Building job history from experiences, count:", experiences.length);
        const jobHistory: JobHistory[] = experiences.map((experience) => {
            const orgKey = `${experience.company}_${"company"}`;
            const org = orgCache[orgKey];
            if (!org) {
                console.warn("No org found for experience", experience.company);
            }

            const startDate = experience.starts_at
                ? `${experience.starts_at.year}-${String(experience.starts_at.month).padStart(2, '0')}`
                : "";
            const endDate = experience.ends_at
                ? `${experience.ends_at.year}-${String(experience.ends_at.month).padStart(2, '0')}`
                : "";

            return {
                id: String(Date.now() + Math.random()), // Example ID generator
                organizationId: org?.id || "",
                employmentType: "",
                jobTitle: experience.title || "",
                companyName: experience.company || "",
                description: experience.description || "",
                companyLogo: "", // We'll fill in after possible upload
                companyLinkedinUrl: experience.company_linkedin_profile_url || "",
                startDate,
                endDate,
                isCurrentRole: experience.ends_at === null,
                location: experience.location || "",
            };
        });

        console.log("Building education history from education, count:", education.length);
        const educationHistory: EducationHistory[] = education.map((edu) => {
            const orgKey = `${edu.school}_${"school"}`;
            const org = orgCache[orgKey];
            if (!org) {
                console.warn("No org found for education", edu.school);
            }

            const startDate = edu.starts_at
                ? `${edu.starts_at.year}-${String(edu.starts_at.month).padStart(2, '0')}`
                : "";
            const endDate = edu.ends_at
                ? `${edu.ends_at.year}-${String(edu.ends_at.month).padStart(2, '0')}`
                : "";

            return {
                id: String(Date.now() + Math.random()),
                organizationId: org?.id || "",
                institutionName: edu.school || "",
                institutionLogo: "", // We'll fill in after possible upload
                institutionLinkedinUrl: edu.school_linkedin_profile_url || "",
                fieldOfStudy: edu.field_of_study || "",
                startDate,
                endDate,
                grade: edu.grade || "",
                description: edu.description || "",
            };
        });

        // 5. **Outside** the transaction, handle image downloads & updates, because
        //    we can't do external fetch calls (logo downloads) inside a transaction.
        console.log("Processing profile image and logos");

        // 5A. Possibly upload the contact's profile image
        let finalContactImg = contactData.img;
        // get the contact ref
        if (!db) {
            throw new Error('Database not initialized');
        }
        const contactRef = db.collection("contacts").doc(contactData.id);
        if (!finalContactImg && linkedInResponse?.profile_pic_url) {
            console.log("Downloading and uploading contact profile image");
            const path = `contacts/${contactRef.id}/profile.jpg`;
            const uploaded = await downloadAndUploadImage(linkedInResponse.profile_pic_url, path);
            if (uploaded) {
                console.log("Successfully uploaded contact profile image");
                finalContactImg = uploaded;
            } else {
                console.log("Failed to upload contact profile image");
            }
        }

        // 5B. For each org, if we have a fresh orgReq.logoUrl, upload it and update the doc
        console.log("Processing organization logos");
        for (const orgReq of uniqueOrgsNeeded) {
            const orgKey = `${orgReq.name}_${orgReq.type}`;
            const org = orgCache[orgKey];
            if (!org) continue;

            // Optional logic: skip if it's "approved" and already has a logo
            if (org.logo && org.status === "approved") {
                continue;
            }

            if (orgReq.logoUrl) {
                console.log(`Downloading and uploading logo for ${orgReq.name}`);
                const path = `organizations/${org.id}/logo.jpg`;
                const uploadedLogo = await downloadAndUploadImage(orgReq.logoUrl, path);
                if (uploadedLogo) {
                    console.log(`Successfully uploaded logo for ${orgReq.name}`);
                    // Update org doc to finalize the new logo
                    await db.collection("organizations").doc(org.id).update({
                        logo: uploadedLogo,
                        status: "approved",
                        updated: new Date(),
                    });
                } else {
                    console.log(`Failed to upload logo for ${orgReq.name}`);
                }
            }
        }

        // 5C. Refresh jobHistory/educationHistory to reflect any newly uploaded logos
        //     (we just updated them above in the org docs)
        console.log("Merging existing job history with LinkedIn data");
        const updatedJobHistory: JobHistory[] = [];
        // First add existing jobs that aren't from LinkedIn (preserve manual entries)
        const existingJobs = contactData.jobHistory || [];
        existingJobs.forEach(job => {
            if (!job.companyLinkedinUrl) { // If no LinkedIn URL, it's likely a manual entry
                updatedJobHistory.push(job);
            }
        });

        // Then process LinkedIn jobs
        for (const jh of jobHistory) {
            // Check if this job already exists
            const existingJob = existingJobs.find(ej =>
                (ej.companyLinkedinUrl && ej.companyLinkedinUrl === jh.companyLinkedinUrl) || // Match by LinkedIn URL
                (ej.companyName === jh.companyName &&
                    ej.startDate === jh.startDate &&
                    ej.jobTitle === jh.jobTitle) // Match by key fields
            );

            if (existingJob) {
                // Merge the jobs, preferring existing data for optional fields
                console.log(`Merging existing job: ${jh.companyName} - ${jh.jobTitle}`);
                updatedJobHistory.push({
                    ...jh,
                    id: existingJob.id,
                    employmentType: existingJob.employmentType || jh.employmentType,
                    jobResponsibilities: existingJob.jobResponsibilities || jh.jobResponsibilities,
                    workEmail: existingJob.workEmail || jh.workEmail,
                });
            } else {
                console.log(`Adding new job from LinkedIn: ${jh.companyName} - ${jh.jobTitle}`);
                // Add new job from LinkedIn
                updatedJobHistory.push(jh);
            }
        }

        console.log("Merging existing education history with LinkedIn data");
        const updatedEducationHistory: EducationHistory[] = [];
        // First add existing education entries that aren't from LinkedIn
        const existingEducation = contactData.educationHistory || [];
        existingEducation.forEach(edu => {
            if (!edu.institutionLinkedinUrl) { // If no LinkedIn URL, it's likely a manual entry
                updatedEducationHistory.push(edu);
            }
        });

        // Then process LinkedIn education entries
        for (const eh of educationHistory) {
            // Check if this education already exists
            const existingEdu = existingEducation.find(ee =>
                (ee.institutionLinkedinUrl && ee.institutionLinkedinUrl === eh.institutionLinkedinUrl) || // Match by LinkedIn URL
                (ee.institutionName === eh.institutionName &&
                    ee.startDate === eh.startDate &&
                    ee.fieldOfStudy === eh.fieldOfStudy) // Match by key fields
            );

            if (existingEdu) {
                // Merge the education entries, preferring existing data for optional fields
                console.log(`Merging existing education: ${eh.institutionName} - ${eh.fieldOfStudy}`);
                updatedEducationHistory.push({
                    ...eh,
                    id: existingEdu.id,
                    degreeOrCertificate: existingEdu.degreeOrCertificate || eh.degreeOrCertificate,
                    grade: existingEdu.grade || eh.grade,
                    educationEmail: existingEdu.educationEmail || eh.educationEmail,
                });
            } else {
                console.log(`Adding new education from LinkedIn: ${eh.institutionName} - ${eh.fieldOfStudy}`);
                // Add new education from LinkedIn
                updatedEducationHistory.push(eh);
            }
        }

        console.log("Updating logos for jobs and education");
        // Update logos for jobs
        for (const jh of updatedJobHistory) {
            if (jh.organizationId) {
                console.log(`Fetching organization data for job: ${jh.companyName}`);
                const orgSnap = await db.collection("organizations").doc(jh.organizationId).get();
                const orgData = orgSnap.data() as any;
                if (orgData?.logo) {
                    console.log(`Updated logo for job: ${jh.companyName}`);
                    jh.companyLogo = orgData.logo;
                }
            }
        }

        for (const eh of updatedEducationHistory) {
            if (eh.organizationId) {
                console.log(`Fetching organization data for education: ${eh.institutionName}`);
                const orgSnap = await db.collection("organizations").doc(eh.organizationId).get();
                const orgData = orgSnap.data() as any;
                if (orgData?.logo) {
                    console.log(`Updated logo for education: ${eh.institutionName}`);
                    eh.institutionLogo = orgData.logo;
                }
            }
        }

        // 6. Instead of updating the contact doc, create and return the enriched contact data
        console.log("Creating enriched contact data to return");
        const enrichedContactData: Contact = {
            ...contactData,
            img: contactData?.img || "",
            name: contactData?.name || linkedInResponse?.name || "",
            firstName: contactData?.firstName || linkedInResponse?.localized_first_name || "",
            lastName: contactData?.lastName || linkedInResponse?.localized_last_name || "",
            location: {
                city: contactData?.location?.city || linkedInResponse?.city || "",
                country: contactData?.location?.country || linkedInResponse?.country || "",
                state: contactData?.location?.state || linkedInResponse?.state || "",
            },
            jobTitle: contactData?.jobTitle || linkedInResponse?.headline || linkedInResponse?.occupation || "",
            linkedinEnrichmentResponse: linkedInResponse,
            jobHistory: updatedJobHistory,
            educationHistory: updatedEducationHistory,
            lastEnrichedAt: new Date(),
            linkedin: contactData.linkedin || ""
        };
        
        // Update the saved enrichment data with the enriched contact information
        await saveLinkedInEnrichmentData(
            contactData.id,
            linkedInResponse,
            enrichedContactData
        );

        // 6. Finally, update the contact doc in Firestore with stable image URLs
        const contactUpdatePayload = removeUndefinedDeep({
            img: contactData?.img || finalContactImg || "",
            name: contactData?.name || linkedInResponse?.name || "",
            firstName: contactData?.firstName || linkedInResponse?.localized_first_name || "",
            lastName: contactData?.lastName || linkedInResponse?.localized_last_name || "",
            location: {
                city: contactData?.location?.city || linkedInResponse?.city || "",
                country: contactData?.location?.country || linkedInResponse?.country || "",
                state: contactData?.location?.state || linkedInResponse?.state || "",
            },
            company:  contactData?.company || updatedJobHistory?.[0]?.companyName || "",
            jobTitle: contactData?.jobTitle || linkedInResponse?.headline || linkedInResponse?.occupation || "",
            linkedinEnrichmentResponse: linkedInResponse,
            jobHistory: updatedJobHistory,
            educationHistory: updatedEducationHistory,
            lastEnrichedAt: new Date(),
        });
        await contactRef.update(contactUpdatePayload);
        
        console.log("LinkedIn enrichment completed successfully");
        return enrichedContactData;

    } catch (error) {
        console.error("Failed to enrich LinkedIn data:", error);
        // Return the original contact data if enrichment fails
        return contactData;
    }
}


export default router 
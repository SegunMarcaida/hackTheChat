import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Img,
    Link,
    Preview,
    Section,
    Tailwind,
    Text,
} from "@react-email/components";
import * as React from "react";


const HtmlContent = ({ html }: { html: string }) => (
    <div dangerouslySetInnerHTML={{ __html: html }} />
);



export const TicketPurchaseConfirmationEmail = ({ 
    eventUrl = mockTicketData.eventUrl, 
    ticketUrl = mockTicketData.ticketUrl, 
    organizationName = mockTicketData.organizationName, 
    organizationLogoUrl = mockTicketData.organizationLogoUrl, 
    eventName = mockTicketData.eventName, 
    ticketOwnerName = mockTicketData.ticketOwnerName, 
    eventImgUrl = mockTicketData.eventImgUrl, 
    customMessage = mockTicketData.customMessage, 
    eventLocation = mockTicketData.eventLocation 
}: { 
    eventUrl?: string, 
    ticketUrl?: string, 
    organizationName?: string, 
    organizationLogoUrl?: string, 
    eventName?: string, 
    ticketOwnerName?: string, 
    eventImgUrl?: string, 
    customMessage?: string, 
    eventLocation?: string 
} = {}) => (
    <Tailwind>

        <Html>
            <Head />
            <Preview>
                {ticketOwnerName?.toUpperCase()}, you've got tickets!
            </Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={box}>
                        {organizationLogoUrl ? <Img
                            width={48}
                            height={48}
                            src={organizationLogoUrl}
                            alt={organizationName}
                        /> : <Text style={heading}>{organizationName}</Text>}

                        <Heading
                            as="h1"
                            className="m-0 mt-[12px] text-[36px] font-semibold leading-[36px] text-gray-900 "
                        >
                            {ticketOwnerName.toUpperCase()}, you've got tickets!
                        </Heading>

                        <Heading
                            as="h2"
                            className="m-0 mt-[8px] text-[30px] font-semibold leading-[30px] text-gray-500 mb-8"
                        >
                            {eventName}
                        </Heading>

                        <Img
                            alt="Herman Miller Chair"
                            className="w-full rounded-[12px] object-cover"
                            height="320"
                            src={eventImgUrl}
                        />


                        <Hr style={hr} />
                        <HtmlContent html={customMessage} />

                        <Hr style={hr} />
                        
                        {/* <Heading
                            as="h3"
                            className="m-0 mt-[16px] text-[20px] font-semibold leading-[20px] text-gray-900 mb-4"
                        >
                            🔥 Sneak Peek: What Awaits You
                        </Heading> */}
                        
                        {/* <div className="grid grid-cols-3 gap-4 mb-6">
                            <div style={statCard}>
                                <Text style={statNumber}>500+</Text>
                                <Text style={statLabel}>Founders & Investors</Text>
                            </div>
                            <div style={statCard}>
                                <Text style={statNumber}>20,000+</Text>
                                <Text style={statLabel}>Intros Made</Text>
                            </div>
                            <div style={statCard}>
                                <Text style={statNumber}>150+</Text>
                                <Text style={statLabel}>People You Can't Afford to Miss</Text>
                            </div>
                        </div> */}

                        {/* <Text style={paragraph}>
                            Click the button below to view the event page or your ticket.
                        </Text> */}
                        <div className="flex justify-between gap-4">
                            <Button className="cursor-pointer" style={button} href={eventUrl}>
                                Event Page
                            </Button>
                            <Button className="cursor-pointer" style={whiteButton} href={ticketUrl}>
                                My Ticket
                            </Button>
                        </div>
                        
                        <Hr style={hr} />
                        
                        <Heading
                            as="h3"
                            className="m-0 mt-[16px] text-[24px] font-semibold leading-[24px] text-gray-900 mb-4"
                        >
                            🤖 AI Super Connector
                        </Heading>
                        
                        <Text style={paragraph}>
                            I'll connect you to the best people attending {eventName}. Message me on WhatsApp and let's get on a call.
                        </Text>
                        
                        <Button className="cursor-pointer" style={whatsappButton} href="https://api.whatsapp.com/send?phone=5491159785985&text=Hi%20Axiom%2C%20could%20you%20help%20me%20connect%20with%20the%20right%20people%3F">
                            💬 Message me on WhatsApp
                        </Button>

                        <div className="grid grid-cols-3 gap-4 mb-6 mt-8 text-pretty">
                            <div style={statCard}>
                                <Text style={statNumber}>500+</Text>
                                <Text style={statLabel}>Founders & Investors</Text>
                            </div>
                            <div style={statCard}>
                                <Text style={statNumber}>178</Text>
                                <Text style={statLabel}>Intros Made for this event</Text>
                            </div>
                            <div style={statCard}>
                                <Text style={statNumber}>150+</Text>
                                <Text style={statLabel}>People You Can't Afford to Miss</Text>
                            </div>
                        </div>
                        
                        {/* <Hr style={hr} />
                    <Text style={paragraph}>
                        If you haven't finished your integration, you might find our{" "}
                        <Link style={anchor} href="https://stripe.com/docs">
                            docs
                        </Link>{" "}
                        handy.
                    </Text>
                    <Text style={paragraph}>
                        Once you're ready to start accepting payments, you'll just need to
                        use your live{" "}
                        <Link
                            style={anchor}
                            href="https://dashboard.stripe.com/login?redirect=%2Fapikeys"
                        >
                            API keys
                        </Link>{" "}
                        instead of your test API keys. Your account can simultaneously be
                        used for both test and live requests, so you can continue testing
                        while accepting live payments. Check out our{" "}
                        <Link style={anchor} href="https://stripe.com/docs/dashboard">
                            tutorial about account basics
                        </Link>
                        .
                    </Text>
                    <Text style={paragraph}>
                        Finally, we've put together a{" "}
                        <Link
                            style={anchor}
                            href="https://stripe.com/docs/checklist/website"
                        >
                            quick checklist
                        </Link>{" "}
                        to ensure your website conforms to card network standards.
                    </Text>
                    <Text style={paragraph}>
                        We'll be here to help you with any step along the way. You can find
                        answers to most questions and get in touch with us on our{" "}
                        <Link style={anchor} href="https://support.stripe.com/">
                            support site
                        </Link>
                        .
                    </Text> */}
                        <Text style={paragraph}>— The {organizationName} team</Text>
                        <Hr style={hr} />
                        <Text style={footer}>
                            Powered by <Link style={anchor} href="https://gomry.com">Gomry</Link>
                        </Text>
                        {/* <div style={unsubscribeSection}>
                            <Link href={`https://gomry.com/notification-settings/events`} style={unsubscribeLink}>
                                Unsubscribe
                            </Link>
                        </div> */}
                    </Section>
                </Container>
            </Body>
        </Html>
    </Tailwind>
);

export default TicketPurchaseConfirmationEmail;

const main = {
    backgroundColor: "#f6f9fc",
    fontFamily:
        '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
    backgroundColor: "#ffffff",
    margin: "0 auto",
    padding: "16px 0 60px",
    maxWidth: "700px",
    width: "100%",
};

const box = {
    padding: "0 16px",
};

const hr = {
    borderColor: "#e6ebf1",
    margin: "20px 0",
};

const paragraph = {
    color: "#71717a",

    fontSize: "16px",
    lineHeight: "24px",
    textAlign: "left" as const,
};

const anchor = {
    color: "#09090b",
    textDecoration: "underline",
};

const button = {
    backgroundColor: "#09090b",
    borderRadius: "5px",
    color: "#fff",
    opacity: 0.9,
    fontSize: "16px",
    fontWeight: "bold",
    textDecoration: "none",
    textAlign: "center" as const,
    width: "40%",
    padding: "10px",
};

const whiteButton = {
    ...button,
    backgroundColor: "#f3f4f6", // Changed to a light gray color
    color: "#09090b",
    marginLeft: "10px",
};

const whatsappButton = {
    backgroundColor: "#25d366", // WhatsApp green color
    borderRadius: "5px",
    color: "#fff",
    opacity: 0.9,
    fontSize: "16px",
    fontWeight: "bold",
    textDecoration: "none",
    textAlign: "center" as const,
    width: "100%",
    padding: "12px 10px",
    marginTop: "16px",
};

const footer = {
    color: "#8898aa",
    fontSize: "12px",
    lineHeight: "16px",
    textAlign: "center" as const,
};



const heading = {
    fontSize: "32px",
    fontWeight: "300",
    color: "#888888",
};

const statCard = {
    backgroundColor: "#f8fafc",
    borderRadius: "8px",
    padding: "16px",
    textAlign: "center" as const,
    border: "1px solid #e2e8f0",
};

const statNumber = {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#09090b",
    margin: "0 0 4px 0",
    lineHeight: "1.2",
};

const statLabel = {
    fontSize: "12px",
    color: "#71717a",
    margin: "0",
    lineHeight: "1.4",
};

// const unsubscribeSection = {
//     textAlign: 'right' as const,
//     marginTop: '20px',
// };

// const unsubscribeLink = {
//     color: '#8898aa',
//     fontSize: '12px',
//     textDecoration: 'underline',
// };

// Mock data for testing
export const mockTicketData = {
    eventUrl: "https://gomry.com/events/sf-founders-summit-2025",
    ticketUrl: "https://gomry.com/tickets/abc123def456",
    organizationName: "SF Founders Network",
    organizationLogoUrl: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=100&h=100&fit=crop&crop=center",
    eventName: "SF Founders Summit 2025",
    ticketOwnerName: "Patrick Turricelli",
    eventImgUrl: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=700&h=320&fit=crop&crop=center",
    customMessage: `
        <p style="color: #71717a; font-size: 16px; line-height: 24px; margin: 16px 0;">
            🚀 <strong>Ready to connect, learn, and grow?</strong>
        </p>
        <p style="color: #71717a; font-size: 16px; line-height: 24px; margin: 16px 0;">
            Your registration for the SF Founders Summit 2025 is confirmed! Join 500+ founders, investors, and innovators for an intensive day of networking, learning, and collaboration in the heart of San Francisco.
        </p>
        <ul style="color: #71717a; font-size: 16px; line-height: 24px; margin: 16px 0; padding-left: 20px;">
            <li><strong>Date:</strong> March 22, 2025</li>
            <li><strong>Time:</strong> 8:00 AM - 6:00 PM (Registration opens at 7:30 AM)</li>
            <li><strong>Location:</strong> Salesforce Tower, San Francisco, CA</li>
            <li><strong>What to bring:</strong> Business cards, laptop, and your entrepreneurial spirit!</li>
        </ul>
        <p style="color: #71717a; font-size: 16px; line-height: 24px; margin: 16px 0;">
            Download our event app for real-time updates, speaker schedules, and to connect with other attendees before the event!
        </p>
    `,
    eventLocation: "Salesforce Tower, San Francisco, CA"
};

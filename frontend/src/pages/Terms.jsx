import React from 'react';

export default function Terms() {
  return (
    <div style={{ fontFamily: "var(--font-body)", color: "var(--ink)", background: "var(--ivory)", minHeight: "100vh", paddingTop: 80 }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "var(--forest)", marginBottom: 24 }}>Terms of Service</h1>
        <p style={{ lineHeight: 1.6, marginBottom: 16 }}>
          Welcome to the Language Resource Workspace (LRW). By accessing or using our platform, you agree to be bound by these Terms of Service.
        </p>
        <h2 style={{ fontSize: 24, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 16 }}>Account Responsibilities</h2>
        <p style={{ lineHeight: 1.6, marginBottom: 16 }}>
          You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
        </p>
        <h2 style={{ fontSize: 24, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 16 }}>Content Ownership</h2>
        <p style={{ lineHeight: 1.6, marginBottom: 16 }}>
          You retain all ownership rights to the documents and data you upload to the LRW platform. By uploading content, you grant us a license to process and analyze that content solely for the purpose of providing the platform's services to you.
        </p>
        <h2 style={{ fontSize: 24, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 16 }}>Acceptable Use</h2>
        <p style={{ lineHeight: 1.6, marginBottom: 16 }}>
          You agree not to use the platform for any unlawful purpose or to upload any content that is illegal, abusive, or infringes on the rights of others. We reserve the right to remove any content or terminate accounts that violate these terms.
        </p>
        <h2 style={{ fontSize: 24, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 16 }}>Limitation of Liability</h2>
        <p style={{ lineHeight: 1.6, marginBottom: 16 }}>
          To the maximum extent permitted by law, LRW and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly.
        </p>
      </div>
    </div>
  );
}

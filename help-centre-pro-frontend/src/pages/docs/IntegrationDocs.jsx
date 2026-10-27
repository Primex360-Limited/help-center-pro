import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, KeyRound, Shield, Webhook } from "lucide-react";
import "../../styles/integration-docs.css";

const API_HOST = "https://helpcentre-pro-admin.onrender.com";
const WEB_HOST = "https://helpcentre-pro-web.onrender.com";
const BASE = `${API_HOST}/api/v1`;

const SECTIONS = [
  { id: "keys", label: "API keys" },
  { id: "visitors", label: "Visitor identity" },
  { id: "messages", label: "Messages" },
  { id: "webhooks", label: "Webhooks" },
  { id: "test", label: "Test script" },
];

const LANGUAGES = [
  { id: "javascript", label: "JavaScript", icon: "JS" },
  { id: "python", label: "Python", icon: "Py" },
  { id: "java", label: "Java", icon: "Java" },
  { id: "curl", label: "cURL", icon: "CLI" },
  { id: "php", label: "PHP", icon: "PHP" },
  { id: "go", label: "Go", icon: "Go" },
];

function CodeBlock({ children, label = "Example" }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(String(children).trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="idocs-code">
      <div className="idocs-code__bar">
        <span>{label}</span>
        <button type="button" onClick={copy} aria-label="Copy code">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  );
}

export default function IntegrationDocs() {
  const [active, setActive] = useState("keys");
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");

  useEffect(() => {
    const hash = (window.location.hash || "").replace("#", "");
    if (hash && SECTIONS.some((s) => s.id === hash)) {
      setActive(hash);
    }

    const nodes = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      Boolean
    );
    if (!nodes.length || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.15, 0.4, 0.7] }
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="idocs">
      <div className="idocs__glow" aria-hidden="true" />

      <header className="idocs-top">
        <Link to="/" className="idocs-brand">
          HelpCentre <span>Pro</span>
        </Link>
        <div className="idocs-top__actions">
          <Link to="/login" className="idocs-btn idocs-btn--primary">
            Sign in
          </Link>
        </div>
      </header>

      <main className="idocs-shell">
        <aside className="idocs-rail" aria-label="Guide sections">
          <p className="idocs-rail__kicker">Developer docs</p>
          <nav className="idocs-rail__nav">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={active === s.id ? "is-active" : undefined}
                onClick={() => setActive(s.id)}
              >
                {s.label}
              </a>
            ))}
          </nav>
          <div className="idocs-rail__card">
            <KeyRound size={16} aria-hidden="true" />
            <div>
              <strong>Get keys</strong>
              <span>Settings → API Token</span>
            </div>
          </div>
        </aside>

        <div className="idocs-content">
          <section className="idocs-hero">
            <p className="idocs-eyebrow">Integration guide</p>
            <h1>Build on Help Centre Pro</h1>
            <p>
              Connect your product with test and live API keys — collect visitor
              email and phone, open chat tickets, send messages, and receive
              signed webhooks.
            </p>
            <div className="idocs-pills" role="navigation" aria-label="On this page">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={active === s.id ? "is-active" : undefined}
                  onClick={() => setActive(s.id)}
                >
                  {s.label}
                </a>
              ))}
            </div>
            <dl className="idocs-meta">
              <div>
                <dt>Base URL</dt>
                <dd>
                  <code>{BASE}</code>
                </dd>
              </div>
              <div>
                <dt>App</dt>
                <dd>
                  <a href={WEB_HOST} target="_blank" rel="noreferrer">
                    {WEB_HOST.replace("https://", "")}
                  </a>
                </dd>
              </div>
            </dl>
          </section>

          <section className="idocs-section" id="keys">
            <div className="idocs-section__head">
              <span className="idocs-icon" aria-hidden="true">
                <Shield size={18} />
              </span>
              <div>
                <h2>Test vs live API keys</h2>
                <p>
                  Each workspace has a <strong>test</strong> and{" "}
                  <strong>live</strong> key pair from Settings → API Token.
                </p>
              </div>
            </div>

            <div className="idocs-grid">
              <article className="idocs-callout">
                <h3>Public keys</h3>
                <p>
                  <code>pk_test_</code> / <code>pk_live_</code> — safe for
                  client apps and widgets.
                </p>
              </article>
              <article className="idocs-callout idocs-callout--warn">
                <h3>Secret keys</h3>
                <p>
                  <code>sk_test_</code> / <code>sk_live_</code> — server only.
                  Never ship in browser or mobile bundles.
                </p>
              </article>
            </div>

            <ul className="idocs-list">
              <li>
                Authenticate with <code>X-HCP-API-Key: pk_test_…</code> or{" "}
                <code>Authorization: Bearer sk_live_…</code>
              </li>
              <li>
                Use this guide for widget visitors, messages, and webhooks only —
                everything you need to connect Help Centre Pro to your app.
              </li>
            </ul>
          </section>

          <section className="idocs-section" id="visitors">
            <div className="idocs-section__head">
              <span className="idocs-icon" aria-hidden="true">
                <KeyRound size={18} />
              </span>
              <div>
                <h2>Collect visitor email and phone</h2>
                <p>
                  Ask for identity before chat starts. Help Centre Pro stores the
                  visitor as a customer and opens a live-chat ticket for agents.
                </p>
              </div>
            </div>
            <CodeBlock label="POST /public/widget/visitor">{`POST ${BASE}/public/widget/visitor
X-HCP-API-Key: pk_test_…
Content-Type: application/json

{
  "email": "ada@example.com",
  "phone": "+2348030000000",
  "name": "Ada Okafor",
  "message": "I need help resetting my password."
}

// 201
{
  "success": true,
  "data": {
    "ticketId": "TK-00042",
    "customerId": "…",
    "mode": "test"
  }
}`}</CodeBlock>
          </section>

          <section className="idocs-section" id="messages">
            <div className="idocs-section__head">
              <span className="idocs-icon" aria-hidden="true">
                <Copy size={18} />
              </span>
              <div>
                <h2>Send follow-up messages</h2>
                <p>
                  Append customer messages to an existing ticket. Agents reply from
                  Live Chat in the workspace.
                </p>
              </div>
            </div>
            <CodeBlock label="POST /public/widget/messages">{`POST ${BASE}/public/widget/messages
Authorization: Bearer sk_test_…
Content-Type: application/json

{
  "ticketId": "TK-00042",
  "message": "Still seeing the same error after clearing cache."
}

// 200
{
  "success": true,
  "data": {
    "ticketId": "TK-00042",
    "messageId": "…"
  }
}`}</CodeBlock>
          </section>

          <section className="idocs-section" id="webhooks">
            <div className="idocs-section__head">
              <span className="idocs-icon" aria-hidden="true">
                <Webhook size={18} />
              </span>
              <div>
                <h2>Webhook events</h2>
                <p>
                  Configure an HTTPS endpoint under Settings → Webhook. Each
                  delivery is a signed <code>POST</code> with your{" "}
                  <code>whsec_…</code> secret.
                </p>
              </div>
            </div>

            <ul className="idocs-list idocs-list--events">
              <li>
                <code>ticket.created</code>
                <span>New ticket opened</span>
              </li>
              <li>
                <code>ticket.updated</code>
                <span>Status or assignee changed</span>
              </li>
              <li>
                <code>ticket.resolved</code>
                <span>Ticket marked resolved</span>
              </li>
              <li>
                <code>customer.created</code>
                <span>New customer profile</span>
              </li>
            </ul>

            <CodeBlock label="Verify X-HCP-Signature">{`Headers:
  Content-Type: application/json
  X-HCP-Event: ticket.created
  X-HCP-Signature: <hmac-sha256-hex of raw body>
  User-Agent: HelpCentrePro-Webhooks/1.0

{
  "id": "evt_…",
  "type": "ticket.created",
  "createdAt": "2026-10-26T12:00:00.000Z",
  "tenantId": "…",
  "tenantSlug": "acme",
  "data": {
    "ticketId": "TK-00042",
    "status": "OPEN",
    "customer": { "email": "ada@example.com", "name": "Ada Okafor" }
  }
}

// Node
const crypto = require("crypto");
const expected = crypto
  .createHmac("sha256", process.env.HCP_WEBHOOK_SECRET)
  .update(rawBody, "utf8")
  .digest("hex");
if (expected !== req.get("X-HCP-Signature")) {
  return res.status(401).end();
}`}</CodeBlock>
          </section>

          <section className="idocs-section" id="test">
            <div className="idocs-section__head">
              <span className="idocs-icon" aria-hidden="true">
                <Check size={18} />
              </span>
              <div>
                <h2>Test Integration Scripts</h2>
                <p>
                  Choose your preferred programming language to test your API keys and verify the integration works correctly.
                </p>
              </div>
            </div>

            <div className="idocs-lang-selector">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  className={`idocs-lang-btn ${selectedLanguage === lang.id ? "is-active" : ""}`}
                  onClick={() => setSelectedLanguage(lang.id)}
                >
                  <span className="idocs-lang-icon">{lang.icon}</span>
                  {lang.label}
                </button>
              ))}
            </div>

            {selectedLanguage === "javascript" && (
              <CodeBlock label="JavaScript/Node.js">{`// test-integration.js
// Run with: node test-integration.js

const API_HOST = "https://helpcentre-pro-admin.onrender.com";
const BASE = \`\${API_HOST}/api/v1\`;

// Replace with your actual test keys from Settings → API Token
const PUBLIC_KEY = "pk_test_YOUR_PUBLIC_KEY_HERE";
const SECRET_KEY = "sk_test_YOUR_SECRET_KEY_HERE";

async function testVisitorEndpoint() {
  console.log("\\n🧪 Testing POST /public/widget/visitor...");
  
  try {
    const response = await fetch(\`\${BASE}/public/widget/visitor\`, {
      method: "POST",
      headers: {
        "X-HCP-API-Key": PUBLIC_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "test@example.com",
        phone: "+2348030000000",
        name: "Test User",
        message: "This is a test message from integration script.",
      }),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log("✅ Visitor endpoint SUCCESS");
      console.log("   Ticket ID:", data.data.ticketId);
      console.log("   Customer ID:", data.data.customerId);
      console.log("   Mode:", data.data.mode);
      return data.data.ticketId;
    } else {
      console.log("❌ Visitor endpoint FAILED");
      console.log("   Status:", response.status);
      console.log("   Error:", data);
      return null;
    }
  } catch (error) {
    console.log("❌ Visitor endpoint ERROR");
    console.log("   Error:", error.message);
    return null;
  }
}

async function testMessagesEndpoint(ticketId) {
  console.log("\\n🧪 Testing POST /public/widget/messages...");
  
  if (!ticketId) {
    console.log("⚠️  Skipping messages test (no ticket ID from previous test)");
    return;
  }

  try {
    const response = await fetch(\`\${BASE}/public/widget/messages\`, {
      method: "POST",
      headers: {
        "Authorization": \`Bearer \${SECRET_KEY}\`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ticketId: ticketId,
        message: "Follow-up test message from integration script.",
      }),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log("✅ Messages endpoint SUCCESS");
      console.log("   Ticket ID:", data.data.ticketId);
      console.log("   Message ID:", data.data.messageId);
    } else {
      console.log("❌ Messages endpoint FAILED");
      console.log("   Status:", response.status);
      console.log("   Error:", data);
    }
  } catch (error) {
    console.log("❌ Messages endpoint ERROR");
    console.log("   Error:", error.message);
  }
}

async function runTests() {
  console.log("🚀 Help Centre Pro Integration Test (Node.js)");
  console.log("==============================================");
  console.log("API Host:", API_HOST);
  console.log("Base URL:", BASE);
  
  if (PUBLIC_KEY === "pk_test_YOUR_PUBLIC_KEY_HERE") {
    console.log("\\n⚠️  WARNING: Please update PUBLIC_KEY with your actual test key");
  }
  if (SECRET_KEY === "sk_test_YOUR_SECRET_KEY_HERE") {
    console.log("⚠️  WARNING: Please update SECRET_KEY with your actual test key");
  }

  const ticketId = await testVisitorEndpoint();
  await testMessagesEndpoint(ticketId);

  console.log("\\n✨ Test complete!");
  console.log("\\n💡 Tips:");
  console.log("   - Get your keys from Settings → API Token in your workspace");
  console.log("   - Use test keys (pk_test_*/sk_test_*) for development");
  console.log("   - Switch to live keys (pk_live_*/sk_live_*) for production");
  console.log("   - Check your workspace to see the created ticket");
}

runTests();`}</CodeBlock>
            )}

            {selectedLanguage === "python" && (
              <CodeBlock label="Python">{`# test_integration.py
# Run with: python test_integration.py

import requests
import json

API_HOST = "https://helpcentre-pro-admin.onrender.com"
BASE = f"{API_HOST}/api/v1"

# Replace with your actual test keys from Settings → API Token
PUBLIC_KEY = "pk_test_YOUR_PUBLIC_KEY_HERE"
SECRET_KEY = "sk_test_YOUR_SECRET_KEY_HERE"

def test_visitor_endpoint():
    print("\\n🧪 Testing POST /public/widget/visitor...")
    
    try:
        response = requests.post(
            f"{BASE}/public/widget/visitor",
            headers={
                "X-HCP-API-Key": PUBLIC_KEY,
                "Content-Type": "application/json",
            },
            json={
                "email": "test@example.com",
                "phone": "+2348030000000",
                "name": "Test User",
                "message": "This is a test message from integration script.",
            }
        )
        
        data = response.json()
        
        if response.ok:
            print("✅ Visitor endpoint SUCCESS")
            print(f"   Ticket ID: {data['data']['ticketId']}")
            print(f"   Customer ID: {data['data']['customerId']}")
            print(f"   Mode: {data['data']['mode']}")
            return data['data']['ticketId']
        else:
            print("❌ Visitor endpoint FAILED")
            print(f"   Status: {response.status_code}")
            print(f"   Error: {data}")
            return None
    except Exception as error:
        print("❌ Visitor endpoint ERROR")
        print(f"   Error: {str(error)}")
        return None

def test_messages_endpoint(ticket_id):
    print("\\n🧪 Testing POST /public/widget/messages...")
    
    if not ticket_id:
        print("⚠️  Skipping messages test (no ticket ID from previous test)")
        return
    
    try:
        response = requests.post(
            f"{BASE}/public/widget/messages",
            headers={
                "Authorization": f"Bearer {SECRET_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "ticketId": ticket_id,
                "message": "Follow-up test message from integration script.",
            }
        )
        
        data = response.json()
        
        if response.ok:
            print("✅ Messages endpoint SUCCESS")
            print(f"   Ticket ID: {data['data']['ticketId']}")
            print(f"   Message ID: {data['data']['messageId']}")
        else:
            print("❌ Messages endpoint FAILED")
            print(f"   Status: {response.status_code}")
            print(f"   Error: {data}")
    except Exception as error:
        print("❌ Messages endpoint ERROR")
        print(f"   Error: {str(error)}")

def run_tests():
    print("🚀 Help Centre Pro Integration Test (Python)")
    print("============================================")
    print(f"API Host: {API_HOST}")
    print(f"Base URL: {BASE}")
    
    if PUBLIC_KEY == "pk_test_YOUR_PUBLIC_KEY_HERE":
        print("\\n⚠️  WARNING: Please update PUBLIC_KEY with your actual test key")
    if SECRET_KEY == "sk_test_YOUR_SECRET_KEY_HERE":
        print("⚠️  WARNING: Please update SECRET_KEY with your actual test key")
    
    ticket_id = test_visitor_endpoint()
    test_messages_endpoint(ticket_id)
    
    print("\\n✨ Test complete!")
    print("\\n💡 Tips:")
    print("   - Get your keys from Settings → API Token in your workspace")
    print("   - Use test keys (pk_test_*/sk_test_*) for development")
    print("   - Switch to live keys (pk_live_*/sk_live_*) for production")
    print("   - Check your workspace to see the created ticket")

if __name__ == "__main__":
    run_tests()`}</CodeBlock>
            )}

            {selectedLanguage === "java" && (
              <CodeBlock label="Java">{`// TestIntegration.java
// Compile with: javac TestIntegration.java
// Run with: java TestIntegration

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

public class TestIntegration {
    private static final String API_HOST = "https://helpcentre-pro-admin.onrender.com";
    private static final String BASE = API_HOST + "/api/v1";
    
    // Replace with your actual test keys from Settings → API Token
    private static final String PUBLIC_KEY = "pk_test_YOUR_PUBLIC_KEY_HERE";
    private static final String SECRET_KEY = "sk_test_YOUR_SECRET_KEY_HERE";
    
    public static void main(String[] args) {
        System.out.println("🚀 Help Centre Pro Integration Test (Java)");
        System.out.println("============================================");
        System.out.println("API Host: " + API_HOST);
        System.out.println("Base URL: " + BASE);
        
        if (PUBLIC_KEY.equals("pk_test_YOUR_PUBLIC_KEY_HERE")) {
            System.out.println("\\n⚠️  WARNING: Please update PUBLIC_KEY with your actual test key");
        }
        if (SECRET_KEY.equals("sk_test_YOUR_SECRET_KEY_HERE")) {
            System.out.println("⚠️  WARNING: Please update SECRET_KEY with your actual test key");
        }
        
        String ticketId = testVisitorEndpoint();
        testMessagesEndpoint(ticketId);
        
        System.out.println("\\n✨ Test complete!");
        System.out.println("\\n💡 Tips:");
        System.out.println("   - Get your keys from Settings → API Token in your workspace");
        System.out.println("   - Use test keys (pk_test_*/sk_test_*) for development");
        System.out.println("   - Switch to live keys (pk_live_*/sk_live_*) for production");
        System.out.println("   - Check your workspace to see the created ticket");
    }
    
    private static String testVisitorEndpoint() {
        System.out.println("\\n🧪 Testing POST /public/widget/visitor...");
        
        try {
            URL url = new URL(BASE + "/public/widget/visitor");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("X-HCP-API-Key", PUBLIC_KEY);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);
            
            String jsonInputString = String.format(
                "{\"email\":\"test@example.com\",\"phone\":\"+2348030000000\",\"name\":\"Test User\",\"message\":\"This is a test message from integration script.\"}"
            );
            
            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = jsonInputString.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }
            
            int responseCode = conn.getResponseCode();
            BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
            StringBuilder response = new StringBuilder();
            String responseLine;
            while ((responseLine = br.readLine()) != null) {
                response.append(responseLine.trim());
            }
            br.close();
            
            if (responseCode == 201) {
                System.out.println("✅ Visitor endpoint SUCCESS");
                // Parse response to get ticketId (simplified)
                System.out.println("   Response: " + response.toString());
                return "TK-00042"; // In production, parse actual response
            } else {
                System.out.println("❌ Visitor endpoint FAILED");
                System.out.println("   Status: " + responseCode);
                System.out.println("   Response: " + response.toString());
                return null;
            }
        } catch (Exception error) {
            System.out.println("❌ Visitor endpoint ERROR");
            System.out.println("   Error: " + error.getMessage());
            return null;
        }
    }
    
    private static void testMessagesEndpoint(String ticketId) {
        System.out.println("\\n🧪 Testing POST /public/widget/messages...");
        
        if (ticketId == null) {
            System.out.println("⚠️  Skipping messages test (no ticket ID from previous test)");
            return;
        }
        
        try {
            URL url = new URL(BASE + "/public/widget/messages");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Authorization", "Bearer " + SECRET_KEY);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);
            
            String jsonInputString = String.format(
                "{\"ticketId\":\"%s\",\"message\":\"Follow-up test message from integration script.\"}",
                ticketId
            );
            
            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = jsonInputString.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }
            
            int responseCode = conn.getResponseCode();
            BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
            StringBuilder response = new StringBuilder();
            String responseLine;
            while ((responseLine = br.readLine()) != null) {
                response.append(responseLine.trim());
            }
            br.close();
            
            if (responseCode == 200) {
                System.out.println("✅ Messages endpoint SUCCESS");
                System.out.println("   Response: " + response.toString());
            } else {
                System.out.println("❌ Messages endpoint FAILED");
                System.out.println("   Status: " + responseCode);
                System.out.println("   Response: " + response.toString());
            }
        } catch (Exception error) {
            System.out.println("❌ Messages endpoint ERROR");
            System.out.println("   Error: " + error.getMessage());
        }
    }
}`}</CodeBlock>
            )}

            {selectedLanguage === "curl" && (
              <CodeBlock label="cURL">{`# Test with cURL (Quick one-liners)

# Test Visitor Endpoint
curl -X POST https://helpcentre-pro-admin.onrender.com/api/v1/public/widget/visitor \\
  -H "X-HCP-API-Key: pk_test_YOUR_PUBLIC_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "test@example.com",
    "phone": "+2348030000000",
    "name": "Test User",
    "message": "This is a test message from cURL."
  }'

# Test Messages Endpoint (replace TICKET_ID with actual ticket ID from above)
curl -X POST https://helpcentre-pro-admin.onrender.com/api/v1/public/widget/messages \\
  -H "Authorization: Bearer sk_test_YOUR_SECRET_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "ticketId": "TK-00042",
    "message": "Follow-up test message from cURL."
  }'

# Windows PowerShell version
# Test Visitor Endpoint
Invoke-RestMethod -Method POST \\
  -Uri "https://helpcentre-pro-admin.onrender.com/api/v1/public/widget/visitor" \\
  -Headers @{
    "X-HCP-API-Key" = "pk_test_YOUR_PUBLIC_KEY_HERE"
    "Content-Type" = "application/json"
  } \\
  -Body '{
    "email": "test@example.com",
    "phone": "+2348030000000",
    "name": "Test User",
    "message": "This is a test message from PowerShell."
  }' | ConvertTo-Json`}</CodeBlock>
            )}

            {selectedLanguage === "php" && (
              <CodeBlock label="PHP">{`<?php
// test_integration.php
// Run with: php test_integration.php

$API_HOST = "https://helpcentre-pro-admin.onrender.com";
$BASE = $API_HOST . "/api/v1";

// Replace with your actual test keys from Settings → API Token
$PUBLIC_KEY = "pk_test_YOUR_PUBLIC_KEY_HERE";
$SECRET_KEY = "sk_test_YOUR_SECRET_KEY_HERE";

function testVisitorEndpoint($base, $publicKey) {
    echo "\\n🧪 Testing POST /public/widget/visitor...\\n";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $base . "/public/widget/visitor");
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "X-HCP-API-Key: " . $publicKey,
        "Content-Type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        "email" => "test@example.com",
        "phone" => "+2348030000000",
        "name" => "Test User",
        "message" => "This is a test message from PHP."
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $data = json_decode($response, true);
    
    if ($httpCode === 201) {
        echo "✅ Visitor endpoint SUCCESS\\n";
        echo "   Ticket ID: " . $data['data']['ticketId'] . "\\n";
        echo "   Customer ID: " . $data['data']['customerId'] . "\\n";
        echo "   Mode: " . $data['data']['mode'] . "\\n";
        return $data['data']['ticketId'];
    } else {
        echo "❌ Visitor endpoint FAILED\\n";
        echo "   Status: " . $httpCode . "\\n";
        echo "   Error: " . json_encode($data) . "\\n";
        return null;
    }
}

function testMessagesEndpoint($base, $secretKey, $ticketId) {
    echo "\\n🧪 Testing POST /public/widget/messages...\\n";
    
    if (!$ticketId) {
        echo "⚠️  Skipping messages test (no ticket ID from previous test)\\n";
        return;
    }
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $base . "/public/widget/messages");
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer " . $secretKey,
        "Content-Type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        "ticketId" => $ticketId,
        "message" => "Follow-up test message from PHP."
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $data = json_decode($response, true);
    
    if ($httpCode === 200) {
        echo "✅ Messages endpoint SUCCESS\\n";
        echo "   Ticket ID: " . $data['data']['ticketId'] . "\\n";
        echo "   Message ID: " . $data['data']['messageId'] . "\\n";
    } else {
        echo "❌ Messages endpoint FAILED\\n";
        echo "   Status: " . $httpCode . "\\n";
        echo "   Error: " . json_encode($data) . "\\n";
    }
}

echo "🚀 Help Centre Pro Integration Test (PHP)\\n";
echo "============================================\\n";
echo "API Host: " . $API_HOST . "\\n";
echo "Base URL: " . $BASE . "\\n";

if ($PUBLIC_KEY === "pk_test_YOUR_PUBLIC_KEY_HERE") {
    echo "\\n⚠️  WARNING: Please update PUBLIC_KEY with your actual test key\\n";
}
if ($SECRET_KEY === "sk_test_YOUR_SECRET_KEY_HERE") {
    echo "⚠️  WARNING: Please update SECRET_KEY with your actual test key\\n";
}

$ticketId = testVisitorEndpoint($BASE, $PUBLIC_KEY);
testMessagesEndpoint($BASE, $SECRET_KEY, $ticketId);

echo "\\n✨ Test complete!\\n";
echo "\\n💡 Tips:\\n";
echo "   - Get your keys from Settings → API Token in your workspace\\n";
echo "   - Use test keys (pk_test_*/sk_test_*) for development\\n";
echo "   - Switch to live keys (pk_live_*/sk_live_*) for production\\n";
echo "   - Check your workspace to see the created ticket\\n";
?>`}</CodeBlock>
            )}

            {selectedLanguage === "go" && (
              <CodeBlock label="Go (Golang)">{`// test_integration.go
// Run with: go run test_integration.go

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

const (
	APIHost  = "https://helpcentre-pro-admin.onrender.com"
	Base     = APIHost + "/api/v1"
	
	// Replace with your actual test keys from Settings → API Token
	PublicKey = "pk_test_YOUR_PUBLIC_KEY_HERE"
	SecretKey = "sk_test_YOUR_SECRET_KEY_HERE"
)

type VisitorRequest struct {
	Email   string \`json:"email"\`
	Phone   string \`json:"phone"\`
	Name    string \`json:"name"\`
	Message string \`json:"message"\`
}

type MessageRequest struct {
	TicketID string \`json:"ticketId"\`
	Message  string \`json:"message"\`
}

type Response struct {
	Success bool \`json:"success"\`
	Data    struct {
		TicketID    string \`json:"ticketId"\`
		CustomerID  string \`json:"customerId"\`
		MessageID   string \`json:"messageId"\`
		Mode        string \`json:"mode"\`
	} \`json:"data"\`
}

func testVisitorEndpoint() string {
	fmt.Println("\\n🧪 Testing POST /public/widget/visitor...")
	
	payload := VisitorRequest{
		Email:   "test@example.com",
		Phone:   "+2348030000000",
		Name:    "Test User",
		Message: "This is a test message from Go.",
	}
	
	jsonPayload, _ := json.Marshal(payload)
	
	req, _ := http.NewRequest("POST", Base+"/public/widget/visitor", bytes.NewBuffer(jsonPayload))
	req.Header.Set("X-HCP-API-Key", PublicKey)
	req.Header.Set("Content-Type", "application/json")
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("❌ Visitor endpoint ERROR")
		fmt.Println("   Error:", err.Error())
		return ""
	}
	defer resp.Body.Close()
	
	body, _ := io.ReadAll(resp.Body)
	var data Response
	json.Unmarshal(body, &data)
	
	if resp.StatusCode == 201 {
		fmt.Println("✅ Visitor endpoint SUCCESS")
		fmt.Println("   Ticket ID:", data.Data.TicketID)
		fmt.Println("   Customer ID:", data.Data.CustomerID)
		fmt.Println("   Mode:", data.Data.Mode)
		return data.Data.TicketID
	} else {
		fmt.Println("❌ Visitor endpoint FAILED")
		fmt.Println("   Status:", resp.StatusCode)
		fmt.Println("   Response:", string(body))
		return ""
	}
}

func testMessagesEndpoint(ticketID string) {
	fmt.Println("\\n🧪 Testing POST /public/widget/messages...")
	
	if ticketID == "" {
		fmt.Println("⚠️  Skipping messages test (no ticket ID from previous test)")
		return
	}
	
	payload := MessageRequest{
		TicketID: ticketID,
		Message:  "Follow-up test message from Go.",
	}
	
	jsonPayload, _ := json.Marshal(payload)
	
	req, _ := http.NewRequest("POST", Base+"/public/widget/messages", bytes.NewBuffer(jsonPayload))
	req.Header.Set("Authorization", "Bearer "+SecretKey)
	req.Header.Set("Content-Type", "application/json")
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("❌ Messages endpoint ERROR")
		fmt.Println("   Error:", err.Error())
		return
	}
	defer resp.Body.Close()
	
	body, _ := io.ReadAll(resp.Body)
	var data Response
	json.Unmarshal(body, &data)
	
	if resp.StatusCode == 200 {
		fmt.Println("✅ Messages endpoint SUCCESS")
		fmt.Println("   Ticket ID:", data.Data.TicketID)
		fmt.Println("   Message ID:", data.Data.MessageID)
	} else {
		fmt.Println("❌ Messages endpoint FAILED")
		fmt.Println("   Status:", resp.StatusCode)
		fmt.Println("   Response:", string(body))
	}
}

func main() {
	fmt.Println("🚀 Help Centre Pro Integration Test (Go)")
	fmt.Println("==========================================")
	fmt.Println("API Host:", APIHost)
	fmt.Println("Base URL:", Base)
	
	if PublicKey == "pk_test_YOUR_PUBLIC_KEY_HERE" {
		fmt.Println("\\n⚠️  WARNING: Please update PublicKey with your actual test key")
	}
	if SecretKey == "sk_test_YOUR_SECRET_KEY_HERE" {
		fmt.Println("⚠️  WARNING: Please update SecretKey with your actual test key")
	}
	
	ticketID := testVisitorEndpoint()
	testMessagesEndpoint(ticketID)
	
	fmt.Println("\\n✨ Test complete!")
	fmt.Println("\\n💡 Tips:")
	fmt.Println("   - Get your keys from Settings → API Token in your workspace")
	fmt.Println("   - Use test keys (pk_test_*/sk_test_*) for development")
	fmt.Println("   - Switch to live keys (pk_live_*/sk_live_*) for production")
	fmt.Println("   - Check your workspace to see the created ticket")
}`}</CodeBlock>
            )}

            <div className="idocs-grid">
              {selectedLanguage === "javascript" && (
                <article className="idocs-callout">
                  <h3>JavaScript/Node.js</h3>
                  <p>
                    Save as <code>test-integration.js</code>, update keys, run with <code>node test-integration.js</code>
                  </p>
                </article>
              )}
              {selectedLanguage === "python" && (
                <article className="idocs-callout">
                  <h3>Python</h3>
                  <p>
                    Save as <code>test_integration.py</code>, install requests with <code>pip install requests</code>, run with <code>python test_integration.py</code>
                  </p>
                </article>
              )}
              {selectedLanguage === "java" && (
                <article className="idocs-callout">
                  <h3>Java</h3>
                  <p>
                    Save as <code>TestIntegration.java</code>, compile with <code>javac TestIntegration.java</code>, run with <code>java TestIntegration</code>
                </p>
              </article>
              )}
              {selectedLanguage === "curl" && (
                <article className="idocs-callout">
                  <h3>cURL</h3>
                  <p>
                    Quick one-liners for testing without creating files. Perfect for quick API validation.
                  </p>
                </article>
              )}
              {selectedLanguage === "php" && (
                <article className="idocs-callout">
                  <h3>PHP</h3>
                  <p>
                    Save as <code>test_integration.php</code>, update keys, run with <code>php test_integration.php</code>
                  </p>
                </article>
              )}
              {selectedLanguage === "go" && (
                <article className="idocs-callout">
                  <h3>Go (Golang)</h3>
                  <p>
                    Save as <code>test_integration.go</code>, run with <code>go run test_integration.go</code>
                  </p>
                </article>
              )}
            </div>

            <div className="idocs-callout idocs-callout--warn" style={{ marginTop: "16px" }}>
              <h3>⚠️ Important Security Notes</h3>
              <p>
                Never commit API keys to version control. Use environment variables or secret management systems. Always use test keys (pk_test_*/sk_test_*) during development. Only switch to live keys (pk_live_*/sk_live_*) in production environments.
              </p>
            </div>
          </section>

          <section className="idocs-cta">
            <div>
              <h2>Ready to integrate?</h2>
              <p>
                Sign in, open Settings → API Token, rotate test or live keys, and
                copy the secret once — it is shown only after regeneration.
              </p>
            </div>
            <div className="idocs-cta__actions">
              <Link to="/login" className="idocs-btn idocs-btn--primary">
                Go to workspace
              </Link>
            </div>
          </section>

          <footer className="idocs-foot">
            <span>© {new Date().getFullYear()} Help Centre Pro</span>
            <a href={WEB_HOST} target="_blank" rel="noreferrer">
              {WEB_HOST.replace("https://", "")}
            </a>
          </footer>
        </div>
      </main>
    </div>
  );
}

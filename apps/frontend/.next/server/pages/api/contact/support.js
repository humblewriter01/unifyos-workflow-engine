"use strict";(()=>{var e={};e.id=910,e.ids=[910],e.modules={8432:e=>{e.exports=require("bcryptjs")},3227:e=>{e.exports=require("next-auth")},145:e=>{e.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},6835:(e,r)=>{Object.defineProperty(r,"l",{enumerable:!0,get:function(){return function e(r,t){return t in r?r[t]:"then"in r&&"function"==typeof r.then?r.then(r=>e(r,t)):"function"==typeof r&&"default"===t?r:void 0}}})},5384:(e,r,t)=>{t.r(r),t.d(r,{config:()=>u,default:()=>l,routeModule:()=>c});var o={};t.r(o),t.d(o,{default:()=>p});var i=t(9150),n=t(1631),s=t(6835),a=t(3227),d=t(2186);async function p(e,r){if("POST"!==e.method)return r.status(405).json({error:"Method not allowed"});let t=await (0,a.getServerSession)(e,r,d.authOptions),{name:o,email:i,subject:n,message:s,category:p}=e.body;if(!o||!i||!n||!s||!p)return r.status(400).json({error:"All fields are required"});try{if(!(await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:"UnifyOS Support <support@unifyos.com>",to:[process.env.SUPPORT_EMAIL],subject:`[UnifyOS Support] ${p}: ${n}`,html:`
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">🎯 New UnifyOS Support Request</h2>
            
            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 4px 0;"><strong>Category:</strong></td>
                  <td style="padding: 4px 0;">
                    <span style="background: #2563eb; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                      ${p.toUpperCase()}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 0;"><strong>From:</strong></td>
                  <td style="padding: 4px 0;">${o} (${i})</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0;"><strong>User ID:</strong></td>
                  <td style="padding: 4px 0;">${t?.user?.id||"Not logged in"}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0;"><strong>Submitted:</strong></td>
                  <td style="padding: 4px 0;">${new Date().toLocaleString()}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: white; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 16px 0;">
              <h3 style="margin-top: 0; color: #1e293b;">${n}</h3>
              <div style="white-space: pre-wrap; line-height: 1.6; color: #475569;">${s}</div>
            </div>

            <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>💡 Quick Reply:</strong> Just reply to this email directly. Your reply will come from "UnifyOS Support" and go to ${i}
              </p>
            </div>

            <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
              <a href="https://unifyos-platform.onrender.com/admin/support" 
                 style="background: #2563eb; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-size: 14px;">
                 View in Admin Panel
              </a>
            </div>
          </div>
        `})})).ok)throw Error("Failed to send support email");return await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:"UnifyOS Support <support@unifyos.com>",to:i,subject:"We received your support request \uD83D\uDE80",html:`
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Thanks for reaching out!</h1>
            
            <p>Hi ${o},</p>
            
            <p>We've received your support request and our team will review it shortly. We typically respond within 24 hours.</p>
            
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #0369a1;">Request Summary</h3>
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 8px 0; color: #475569;"><strong>Request ID:</strong></td>
                  <td style="padding: 8px 0;">${Date.now()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #475569;"><strong>Category:</strong></td>
                  <td style="padding: 8px 0;">
                    <span style="background: #2563eb; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">
                      ${p}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #475569;"><strong>Subject:</strong></td>
                  <td style="padding: 8px 0;">${n}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #475569;"><strong>Submitted:</strong></td>
                  <td style="padding: 8px 0;">${new Date().toLocaleString()}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: white; padding: 16px; border-left: 4px solid #2563eb; margin: 16px 0;">
              <p style="white-space: pre-wrap; margin: 0; color: #475569;">${s}</p>
            </div>
            
            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; color: #065f46; font-size: 14px;">
                <strong>📚 Need immediate help?</strong> Check out our <a href="https://unifyos.com/help" style="color: #059669; font-weight: 500;">Help Center</a> for quick answers to common questions.
              </p>
            </div>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 24px;">
              Best regards,<br>
              <strong>The UnifyOS Team</strong>
            </p>
            
            <div style="text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 12px;">
                UnifyOS - Automate Your Workflow<br>
                <a href="https://unifyos-platform.onrender.com" style="color: #2563eb;">unifyos-platform.onrender.com</a>
              </p>
            </div>
          </div>
        `})}),r.status(200).json({success:!0,message:"Support request sent successfully"})}catch(e){return console.error("Support request error:",e),r.status(500).json({error:"Failed to send support request"})}}let l=(0,s.l)(o,"default"),u=(0,s.l)(o,"config"),c=new i.PagesAPIRouteModule({definition:{kind:n.x.PAGES_API,page:"/api/contact/support",pathname:"/api/contact/support",bundlePath:"",filename:""},userland:o})},5911:(e,r,t)=>{t.d(r,{Z:()=>i});let o=require("@prisma/client"),i=globalThis.prisma??new o.PrismaClient({log:["error"]})},2186:(e,r,t)=>{t.r(r),t.d(r,{authOptions:()=>f,default:()=>m});var o=t(3227),i=t.n(o);let n=require("next-auth/providers/credentials");var s=t.n(n);let a=require("next-auth/providers/google");var d=t.n(a);let p=require("next-auth/providers/email");var l=t.n(p);let u=require("@next-auth/prisma-adapter");var c=t(8432),g=t(5911);let f={adapter:(0,u.PrismaAdapter)(g.Z),providers:[l()({server:{host:process.env.EMAIL_SERVER_HOST||"smtp.resend.com",port:parseInt(process.env.EMAIL_SERVER_PORT||"587"),auth:{user:process.env.EMAIL_SERVER_USER||"resend",pass:process.env.EMAIL_SERVER_PASSWORD||process.env.RESEND_API_KEY}},from:process.env.EMAIL_FROM||"UnifyOS <onboarding@resend.dev>",sendVerificationRequest:async({identifier:e,url:r,provider:t})=>{try{let o=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:t.from,to:e,subject:"Sign in to UnifyOS",html:`
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1 style="color: #2563eb;">Sign in to UnifyOS</h1>
                  <p>Click the link below to sign in to your account:</p>
                  <a href="${r}" 
                     style="background-color: #2563eb; color: white; padding: 12px 24px; 
                            text-decoration: none; border-radius: 6px; display: inline-block;">
                    Sign in to UnifyOS
                  </a>
                  <p style="margin-top: 20px; color: #6b7280;">
                    Or copy and paste this link in your browser:<br/>
                    <code style="background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px;">
                      ${r}
                    </code>
                  </p>
                  <p style="color: #6b7280; font-size: 14px;">
                    This link will expire in 24 hours.
                  </p>
                </div>
              `})});if(!o.ok){let e=await o.json();throw Error(`Resend error: ${e.message}`)}console.log(`✅ Sign-in email sent to ${e}`)}catch(e){throw console.error("❌ Email sending error:",e),e}}}),s()({name:"credentials",credentials:{email:{label:"Email",type:"email"},password:{label:"Password",type:"password"}},async authorize(e){if(!e?.email||!e?.password)throw Error("Invalid credentials");let r=await g.Z.user.findUnique({where:{email:e.email}});if(!r||!r.passwordHash||!await (0,c.compare)(e.password,r.passwordHash))throw Error("Invalid credentials");if(!r.emailVerified)throw Error("Please verify your email before logging in");return await g.Z.user.update({where:{id:r.id},data:{lastLoginAt:new Date}}),{id:r.id,email:r.email,name:r.name,plan:r.plan}}}),d()({clientId:process.env.GOOGLE_CLIENT_ID,clientSecret:process.env.GOOGLE_CLIENT_SECRET,authorization:{params:{prompt:"consent",access_type:"offline",response_type:"code",scope:"openid email profile"}}})],session:{strategy:"jwt",maxAge:2592e3},pages:{signIn:"/auth/login",signOut:"/auth/logout",error:"/auth/error",verifyRequest:"/auth/verify-email",newUser:"/auth/welcome"},callbacks:{jwt:async({token:e,user:r,account:t})=>(r&&(e.id=r.id,e.plan=r.plan),t?.access_token&&(e.accessToken=t.access_token),e),session:async({session:e,token:r})=>(e.user&&(e.user.id=r.id,e.user.plan=r.plan),e),async signIn({user:e,account:r,profile:t}){if(r?.provider==="google"){let r=await g.Z.user.findUnique({where:{email:e.email}});r?await g.Z.user.update({where:{id:r.id},data:{lastLoginAt:new Date}}):await g.Z.user.create({data:{email:e.email,name:e.name,emailVerified:!0,plan:"FREE"}})}if(r?.provider==="email"){let r=await g.Z.user.findUnique({where:{email:e.email}});if(r&&!r.emailVerified)return!1}return!0}},events:{async createUser({user:e}){console.log(`New user created: ${e.email}`)},async linkAccount({user:e,account:r}){console.log(`Account linked: ${e.email} with ${r.provider}`)},async signIn({user:e,isNewUser:r}){console.log(`User signed in: ${e.email} ${r?"(new user)":""}`)},async signOut({token:e}){console.log(`User signed out: ${e.email}`)}},debug:!1},m=i()(f)},1631:(e,r)=>{var t;Object.defineProperty(r,"x",{enumerable:!0,get:function(){return t}}),function(e){e.PAGES="PAGES",e.PAGES_API="PAGES_API",e.APP_PAGE="APP_PAGE",e.APP_ROUTE="APP_ROUTE"}(t||(t={}))},9150:(e,r,t)=>{e.exports=t(145)}};var r=require("../../../webpack-api-runtime.js");r.C(e);var t=r(r.s=5384);module.exports=t})();
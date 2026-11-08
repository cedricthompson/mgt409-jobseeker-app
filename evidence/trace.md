# Traced agent runs

Run on 2026-11-08 with gpt-6-luna. Cache off, so these are first-time token costs.

## Andre (DC, IT help desk, Secret clearance)

| Step | Agent | Time | Calls | Prompt tokens | Completion tokens | Output |
|---|---|---|---|---|---|---|
| 1 | Intake (resume import) | 3.7s | 1 | 313 | 435 | You have three years of information technology help desk experience at Johns Hopkins, CompTIA A+ and Security+ certifications, and an active Secret clearance. You are seeking hybrid Information Technology Specialist role |
| 2 | Orchestrator -> Intake/Gap | 0.5s | 1 | 434 | 392 | [gap] About how many users or support tickets did you handle, and did you meet service targets or improve resolution times? |
| 3 | Orchestrator -> Intake/Gap (answer) | 9.4s | 1 | 483 | 429 | [gap] Did you consistently meet service targets, such as response or resolution times, or help improve them? |
| 4 | Job Matcher | 25.5s | 1 | 1875 | 1034 | 19 jobs considered (sample data); top: IT Specialist (Customer Support), GS-9 (strong); Help Desk Technician (good); IT Support Analyst (Remote) (good) |
| 5 | Scorecard | 9.9s | 1 | 836 | 1100 | 84/100 (interview 62%, hire 34%); 82/100 (interview 72%, hire 48%); 86/100 (interview 42%, hire 22%) |
| 6 | Application Coach (cover letter) | 5.6s | 1 | 499 | 554 | 164 words; tips: Add your contact information and the date before submitting. / Check the vacancy announcement for any required application details or specialized experience language. / Do not describe your Secret cleara |
| | **Total** | **54.6s** | **6** | **4440** | **3944** | **8384 tokens per applicant** |

## Maria (Columbus, line cook to kitchen manager)

| Step | Agent | Time | Calls | Prompt tokens | Completion tokens | Output |
|---|---|---|---|---|---|---|
| 1 | Intake (resume import) | 3.6s | 1 | 303 | 381 | You have three years of line cook experience at Applebee's, including training new hires and running the weekend grill station. You are targeting a kitchen manager role paying $50,000, with an on-site commute of up to 25 |
| 2 | Orchestrator -> Intake/Gap | 4.0s | 1 | 429 | 509 | [gap] On weekend grill shifts, were you responsible for directing other cooks or coordinating the shift, and if so, how many people did you lead? |
| 3 | Orchestrator -> Intake/Gap (answer) | 4.1s | 1 | 483 | 410 | [gap] Did you also handle food inventory or ordering at Applebee’s, and if so, what were you responsible for? |
| 4 | Job Matcher | 13.6s | 1 | 1313 | 1429 | 8 jobs considered (live data); top: Kitchen Manager (good); Kitchen Manager (Reynoldsburg) (good); Kitchen Manager (good) |
| 5 | Scorecard | 8.4s | 1 | 927 | 961 | 76/100 (interview 62%, hire 27%); 79/100 (interview 68%, hire 32%); 78/100 (interview 59%, hire 25%) |
| 6 | Application Coach (cover letter) | 4.2s | 1 | 496 | 397 | 142 words; tips: Add the hiring manager’s name if you can find it. / Include a specific example of how you helped your team handle a busy shift, if available. / Confirm the location name and address before sending. |
| | **Total** | **37.8s** | **6** | **3951** | **4087** | **8038 tokens per applicant** |

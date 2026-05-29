/**
 * Interview Report Generator
 * Generates comprehensive reports for completed interviews
 * Used for both candidate feedback and company/leaderboard scoring
 */

class InterviewReportGenerator
{
    /**
     * Generate a full report from an interview document
     * @param {Object} interview - The AIInterview document
     * @returns {Object} - Report object with scores, summary, details
     */
    generateReport(interview)
    {
        const codingScore=this.calculateCodingScore(interview.codeSubmissions||[]);
        const proctoringScore=this.calculateProctoringScore(interview.proctoringEvents||[]);
        const communicationScore=this.calculateCommunicationScore(interview.questionAnswerPairs||[]);
        const problemSolvingScore=this.calculateProblemSolvingScore(interview.codeSubmissions||[], interview.questionAnswerPairs||[]);
        const timeScore=this.calculateTimeScore(interview);

        // Weighted overall score
        const overallScore=Math.round(
            codingScore*0.35+
            problemSolvingScore*0.20+
            communicationScore*0.15+
            proctoringScore*0.20+
            timeScore*0.10
        );

        const sectionScores={
            technical: codingScore,
            communication: communicationScore,
            problemSolving: problemSolvingScore,
            domain: Math.round((codingScore+problemSolvingScore)/2),
            aptitude: Math.round((problemSolvingScore+timeScore)/2),
        };

        const submissionDetails=this.buildSubmissionDetails(interview.codeSubmissions||[]);
        const strengths=this.identifyStrengths(sectionScores);
        const improvements=this.identifyImprovements(sectionScores);
        const grade=this.assignGrade(overallScore);

        return {
            interviewId: interview.sessionId,
            candidateName: interview.candidateName,
            role: interview.role,
            experience: interview.experience,
            duration: this.getDurationMinutes(interview),
            completedAt: interview.endTime||new Date(),

            overallScore,
            grade,
            sectionScores,

            summary: {
                totalQuestions: (interview.questionAnswerPairs||[]).length,
                totalSubmissions: (interview.codeSubmissions||[]).length,
                totalTestsPassed: submissionDetails.totalPassed,
                totalTestsRun: submissionDetails.totalTests,
                passRate: submissionDetails.totalTests>0
                    ? Math.round((submissionDetails.totalPassed/submissionDetails.totalTests)*100)
                    :0,
                proctoringViolations: (interview.proctoringEvents||[]).length,
                criticalViolations: (interview.proctoringEvents||[]).filter(e => e.severity==='critical').length,
                integrityScore: proctoringScore,
            },

            submissions: submissionDetails.submissions,
            strengths,
            improvements,

            // Human-readable report text
            reportText: this.generateTextReport({
                interview,
                overallScore,
                grade,
                sectionScores,
                submissionDetails,
                strengths,
                improvements,
                proctoringScore,
            }),
        };
    }

    calculateCodingScore(submissions)
    {
        if (!submissions||submissions.length===0) return 0;

        let totalWeightedScore=0;
        let totalWeight=0;

        for (const sub of submissions)
        {
            if (sub.total&&sub.total>0)
            {
                const passRate=(sub.passed||0)/sub.total;
                totalWeightedScore+=passRate*100;
                totalWeight+=1;
            }
        }

        return totalWeight>0? Math.round(totalWeightedScore/totalWeight):0;
    }

    calculateProctoringScore(events)
    {
        let score=100;
        for (const event of events)
        {
            switch (event.severity)
            {
                case 'low': score-=3; break;
                case 'medium': score-=7; break;
                case 'high': score-=15; break;
                case 'critical': score-=25; break;
                default: score-=5;
            }
        }
        return Math.max(0, Math.min(100, score));
    }

    calculateCommunicationScore(qaPairs)
    {
        if (!qaPairs||qaPairs.length===0) return 50; // neutral if no Q&A

        let totalScore=0;
        let count=0;

        for (const qa of qaPairs)
        {
            if (qa.answer&&qa.answer.trim().length>0)
            {
                const answerLen=qa.answer.trim().length;
                // Score based on answer quality (length as proxy)
                let score=50;
                if (answerLen>200) score=70;
                if (answerLen>500) score=85;
                if (answerLen>1000) score=95;
                // Bonus if evaluation exists and has score
                if (qa.evaluation&&typeof qa.evaluation.score==='number')
                {
                    score=qa.evaluation.score;
                }
                totalScore+=score;
                count++;
            } else
            {
                totalScore+=10; // Very low score for unanswered
                count++;
            }
        }

        return count>0? Math.round(totalScore/count):50;
    }

    calculateProblemSolvingScore(submissions, qaPairs)
    {
        let score=50;

        // Boost for submissions that pass all tests
        const perfectSubmissions=submissions.filter(s => s.passed===s.total&&s.total>0);
        if (perfectSubmissions.length>0)
        {
            score+=perfectSubmissions.length*15;
        }

        // Boost for multiple attempts (shows persistence)
        if (submissions.length>1) score+=10;

        // Boost for answering follow-up questions
        const followUps=qaPairs.filter(qa => qa.followUps&&qa.followUps.length>0);
        if (followUps.length>0) score+=10;

        return Math.min(100, Math.max(0, score));
    }

    calculateTimeScore(interview)
    {
        const duration=this.getDurationMinutes(interview);
        const expected=interview.duration||30;

        if (duration<=0) return 50;

        // Perfect score if completed within expected time, deductions for going over
        const ratio=duration/expected;
        if (ratio<=0.5) return 70; // Too fast might mean not thorough
        if (ratio<=1.0) return 95; // Completed on time
        if (ratio<=1.3) return 80; // Slightly over
        if (ratio<=1.5) return 65; // Moderately over
        return 50; // Significantly over time
    }

    getDurationMinutes(interview)
    {
        if (interview.endTime&&interview.startTime)
        {
            return Math.round((new Date(interview.endTime)-new Date(interview.startTime))/60000);
        }
        return interview.duration||30;
    }

    buildSubmissionDetails(submissions)
    {
        let totalPassed=0;
        let totalTests=0;
        const subs=[];

        for (const sub of submissions)
        {
            const passed=sub.passed||0;
            const total=sub.total||0;
            totalPassed+=passed;
            totalTests+=total;

            subs.push({
                questionId: sub.questionId,
                language: sub.language,
                passed,
                total,
                score: total>0? Math.round((passed/total)*100):0,
                timestamp: sub.timestamp,
            });
        }

        return {submissions: subs, totalPassed, totalTests};
    }

    identifyStrengths(scores)
    {
        const strengths=[];
        if (scores.technical>=80) strengths.push('Strong coding skills');
        if (scores.communication>=80) strengths.push('Excellent communication');
        if (scores.problemSolving>=80) strengths.push('Great problem-solving ability');
        if (scores.domain>=80) strengths.push('Strong domain knowledge');
        if (scores.aptitude>=80) strengths.push('Strong aptitude and time management');
        if (strengths.length===0) strengths.push('Shows potential for growth');
        return strengths;
    }

    identifyImprovements(scores)
    {
        const improvements=[];
        if (scores.technical<60) improvements.push('Practice coding problems regularly');
        if (scores.communication<60) improvements.push('Work on explaining solutions clearly');
        if (scores.problemSolving<60) improvements.push('Focus on algorithmic thinking');
        if (scores.domain<60) improvements.push('Deepen domain expertise');
        if (scores.aptitude<60) improvements.push('Improve time management');
        return improvements;
    }

    assignGrade(score)
    {
        if (score>=90) return 'A+';
        if (score>=80) return 'A';
        if (score>=70) return 'B+';
        if (score>=60) return 'B';
        if (score>=50) return 'C';
        if (score>=40) return 'D';
        return 'F';
    }

    generateTextReport({interview, overallScore, grade, sectionScores, submissionDetails, strengths, improvements, proctoringScore})
    {
        const duration=this.getDurationMinutes(interview);
        const lines=[
            `══════════════════════════════════════════`,
            `       INTERVIEW REPORT — ${interview.candidateName}`,
            `══════════════════════════════════════════`,
            ``,
            `Role: ${interview.role}`,
            `Experience: ${interview.experience}`,
            `Duration: ${duration} minutes`,
            `Date: ${new Date(interview.endTime||Date.now()).toLocaleDateString()}`,
            ``,
            `─── OVERALL SCORE ───`,
            `Score: ${overallScore}/100 (Grade: ${grade})`,
            ``,
            `─── SECTION SCORES ───`,
            `  Technical:       ${sectionScores.technical}/100`,
            `  Communication:   ${sectionScores.communication}/100`,
            `  Problem Solving: ${sectionScores.problemSolving}/100`,
            `  Domain:          ${sectionScores.domain}/100`,
            `  Aptitude:        ${sectionScores.aptitude}/100`,
            ``,
            `─── CODE SUBMISSIONS ───`,
            `  Total Submissions: ${submissionDetails.submissions.length}`,
            `  Tests Passed: ${submissionDetails.totalPassed}/${submissionDetails.totalTests}`,
            `  Pass Rate: ${submissionDetails.totalTests>0? Math.round((submissionDetails.totalPassed/submissionDetails.totalTests)*100):0}%`,
            ``,
            `─── PROCTORING ───`,
            `  Integrity Score: ${proctoringScore}/100`,
            `  Violations: ${(interview.proctoringEvents||[]).length}`,
            ``,
        ];

        if (strengths.length>0)
        {
            lines.push(`─── STRENGTHS ───`);
            strengths.forEach(s => lines.push(`  ✓ ${s}`));
            lines.push('');
        }

        if (improvements.length>0)
        {
            lines.push(`─── AREAS FOR IMPROVEMENT ───`);
            improvements.forEach(s => lines.push(`  → ${s}`));
            lines.push('');
        }

        lines.push(`══════════════════════════════════════════`);
        return lines.join('\n');
    }
}

export default new InterviewReportGenerator();

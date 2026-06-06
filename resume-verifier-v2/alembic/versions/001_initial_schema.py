"""Initial schema — all five tables

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── analysis_jobs ─────────────────────────────────────────────────────────
    op.create_table(
        "analysis_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("candidate_id", sa.String(255), nullable=False),
        sa.Column("github_url", sa.String(1024), nullable=False),
        sa.Column("resume_text", sa.Text, nullable=False),
        sa.Column(
            "status",
            sa.Enum("queued", "processing", "completed", "failed", name="jobstatus"),
            nullable=False,
            server_default="queued",
        ),
        sa.Column("celery_task_id", sa.String(255), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_analysis_jobs_candidate_id", "analysis_jobs", ["candidate_id"])
    op.create_index("ix_analysis_jobs_status", "analysis_jobs", ["status"])

    # ── repository_metadata ───────────────────────────────────────────────────
    op.create_table(
        "repository_metadata",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("analysis_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("github_url", sa.String(1024), nullable=False),
        sa.Column("default_branch", sa.String(100), server_default="main"),
        sa.Column("file_count", sa.Integer, server_default="0"),
        sa.Column("folder_count", sa.Integer, server_default="0"),
        sa.Column("total_size_bytes", sa.Integer, server_default="0"),
        sa.Column("languages", postgresql.JSON, server_default="{}"),
        sa.Column("frameworks", postgresql.JSON, server_default="[]"),
        sa.Column("dependencies", postgresql.JSON, server_default="{}"),
        sa.Column("has_dockerfile", sa.Boolean, server_default="false"),
        sa.Column("has_docker_compose", sa.Boolean, server_default="false"),
        sa.Column("has_readme", sa.Boolean, server_default="false"),
        sa.Column("has_tests", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["analysis_id"], ["analysis_jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_repository_metadata_analysis_id", "repository_metadata", ["analysis_id"])

    # ── analysis_results ──────────────────────────────────────────────────────
    op.create_table(
        "analysis_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("analysis_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("trust_score", sa.Float, server_default="0"),
        sa.Column("quality_score", sa.Float, server_default="0"),
        sa.Column("authenticity_score", sa.Float, server_default="0"),
        sa.Column("architecture_score", sa.Float, server_default="0"),
        sa.Column("security_score", sa.Float, server_default="0"),
        sa.Column("feature_verification_score", sa.Float, server_default="0"),
        sa.Column("risk_level", sa.String(20), server_default="MEDIUM"),
        sa.Column("recommendation", sa.String(200), server_default=""),
        sa.Column("ast_metadata", postgresql.JSON, server_default="{}"),
        sa.Column("authenticity_reasoning", postgresql.JSON, server_default="[]"),
        sa.Column("processing_time_seconds", sa.Float, server_default="0"),
        sa.Column("graph_trace", postgresql.JSON, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["analysis_id"], ["analysis_jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("analysis_id"),
    )
    op.create_index("ix_analysis_results_analysis_id", "analysis_results", ["analysis_id"])

    # ── claim_results ─────────────────────────────────────────────────────────
    op.create_table(
        "claim_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("analysis_result_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("claim", sa.String(500), nullable=False),
        sa.Column("verified", sa.Boolean, server_default="false"),
        sa.Column("confidence", sa.Float, server_default="0"),
        sa.Column("depth", sa.String(20), server_default="none"),
        sa.Column("reasoning", sa.Text, server_default=""),
        sa.Column("evidence", postgresql.JSON, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["analysis_result_id"], ["analysis_results.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_claim_results_analysis_result_id", "claim_results", ["analysis_result_id"])

    # ── verification_reports ──────────────────────────────────────────────────
    op.create_table(
        "verification_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("analysis_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("candidate_id", sa.String(255), nullable=False),
        sa.Column("repository_summary", postgresql.JSON, server_default="{}"),
        sa.Column("verified_claims", postgresql.JSON, server_default="[]"),
        sa.Column("missing_claims", postgresql.JSON, server_default="[]"),
        sa.Column("trust_score", sa.Float, server_default="0"),
        sa.Column("quality_score", sa.Float, server_default="0"),
        sa.Column("authenticity_score", sa.Float, server_default="0"),
        sa.Column("risk_level", sa.String(20), server_default="MEDIUM"),
        sa.Column("recommendation", sa.String(200), server_default=""),
        sa.Column("full_report", postgresql.JSON, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["analysis_id"], ["analysis_jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("analysis_id"),
    )
    op.create_index("ix_verification_reports_analysis_id", "verification_reports", ["analysis_id"])
    op.create_index("ix_verification_reports_candidate_id", "verification_reports", ["candidate_id"])


def downgrade() -> None:
    op.drop_table("verification_reports")
    op.drop_table("claim_results")
    op.drop_table("analysis_results")
    op.drop_table("repository_metadata")
    op.drop_table("analysis_jobs")
    op.execute("DROP TYPE IF EXISTS jobstatus")

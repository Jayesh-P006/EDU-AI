"""Add lines_of_code and commit_count to repository_metadata

Revision ID: 002
Revises: 001
Create Date: 2026-06-07
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("repository_metadata", sa.Column("lines_of_code", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("repository_metadata", sa.Column("commit_count", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("repository_metadata", "commit_count")
    op.drop_column("repository_metadata", "lines_of_code")

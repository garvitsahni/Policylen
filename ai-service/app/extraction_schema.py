from pydantic import BaseModel, Field
from typing import Optional


class ConfidenceField(BaseModel):
    value: str
    confidence: str  # high|medium|low


class WaitingPeriod(BaseModel):
    condition: str = Field(description="Condition or disease name")
    period_months: int = Field(description="Waiting period in months")
    period_type: str = Field(description="ped|specific_disease|initial")
    source_excerpt: str = Field(description="Verbatim text from document")
    confidence: str  # high|medium|low


class SubLimit(BaseModel):
    procedure: str = Field(description="Procedure or condition name")
    cap_value: int = Field(description="Maximum payable amount in rupees")
    cap_type: str = Field(description="fixed_amount|percentage")
    source_excerpt: str = Field(description="Verbatim text from document")
    confidence: str  # high|medium|low


class Exclusion(BaseModel):
    condition: str = Field(description="Excluded condition or treatment")
    is_permanent: bool = Field(description="Whether exclusion is permanent")
    source_excerpt: str = Field(description="Verbatim text from document")
    confidence: str  # high|medium|low


class CoPay(BaseModel):
    percentage: Optional[float] = Field(
        default=None,
        description="Co-pay percentage if stated in document"
    )
    age_linked: Optional[bool] = Field(
        default=None,
        description="Whether co-pay is age-linked"
    )
    age_threshold: Optional[int] = Field(
        default=None,
        description="Age above which co-pay applies, if age-linked"
    )
    source_excerpt: Optional[str] = Field(default=None)
    confidence: str


class RoomRentClause(BaseModel):
    cap_type: Optional[str] = Field(
        default=None,
        description="percentage_of_sum_insured|fixed_amount_per_day|no_cap"
    )
    cap_value: Optional[float] = Field(
        default=None,
        description="Cap percentage or amount"
    )
    has_proportionate_deduction: Optional[bool] = Field(
        default=None,
        description="Whether clause has proportionate deduction for higher room"
    )
    source_excerpt: Optional[str] = Field(default=None)
    confidence: str


class ClaimProcessStep(BaseModel):
    step_name: str = Field(description="e.g., cashless, reimbursement, intimation")
    timeframe_hours: Optional[int] = Field(
        default=None,
        description="Intimation deadline in hours if stated"
    )
    source_excerpt: Optional[str] = Field(default=None)
    confidence: str


class PolicyExtraction(BaseModel):
    insurer_name: Optional[str] = Field(default=None)
    sum_insured: Optional[int] = Field(
        default=None,
        description="Overall sum insured in rupees"
    )
    sum_insured_confidence: str = "medium"

    waiting_periods: list[WaitingPeriod] = Field(default_factory=list)
    sub_limits: list[SubLimit] = Field(default_factory=list)
    exclusions: list[Exclusion] = Field(default_factory=list)
    co_pay: Optional[CoPay] = None
    room_rent_clause: Optional[RoomRentClause] = None
    claim_process: list[ClaimProcessStep] = Field(default_factory=list)

    has_restoration_benefit: Optional[bool] = None
    has_no_claim_bonus: Optional[bool] = None
    ped_waiting_period_months: Optional[int] = Field(
        default=None,
        description="PED waiting period in months if found"
    )
    initial_waiting_days: Optional[int] = Field(
        default=None,
        description="Initial 30-day waiting period in days"
    )

    overall_confidence: str = "medium"
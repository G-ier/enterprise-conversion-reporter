AWS_REGION ?= us-east-1
AWS_ACCOUNT_ID ?= 033156084586
AWS_PROFILE ?= new-efflux

STACK_NAME ?= efflux-conversions-reporting-solution

deploy-prod:
	@aws cloudformation deploy \
		--stack-name $(STACK_NAME) \
		--capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM  \
		--template-file template.yaml \
    --parameter-overrides \
			OperatorEmail=deni@roi.ad \
		--tags project=efflux \
		--profile $(AWS_PROFILE) \
		--region $(AWS_REGION)

destroy-stack:
	@echo "Destroying stack using SAM"
	@sam delete \
		--stack-name $(STACK_NAME) \
		--region $(AWS_REGION) \
		--profile $(AWS_PROFILE)



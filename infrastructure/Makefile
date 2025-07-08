AWS_REGION ?=
AWS_ACCOUNT_ID ?=
AWS_PROFILE ?=

STACK_NAME ?= efflux-conversions-reporting-solution

deploy-prod:
	@echo "Deploying stack using SAM"
	@sam deploy \
		--no-confirm-changeset \
		--template-file template.yaml \
		--stack-name $(STACK_NAME) \
		--region $(AWS_REGION) \
		--profile $(AWS_PROFILE) \
		--capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM  \
		--parameter-overrides \
			OperatorEmail=example@gmail.com \
		--tags project=efflux 

destroy-stack:
	@echo "Destroying stack using SAM"
	@sam delete \
		--stack-name $(STACK_NAME) \
		--region $(AWS_REGION) \
		--profile $(AWS_PROFILE)



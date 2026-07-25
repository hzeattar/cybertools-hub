import { memo } from 'react';
import { useWatch } from 'react-hook-form';
import { Constants } from 'librechat-data-provider';
import type { TConversation } from 'librechat-data-provider';
import type { SetterOrUpdater } from 'recoil';
import { useChatContext, useChatFormContext } from '~/Providers';
import AddedConvo from './AddedConvo';
import SmartCapabilityAdvisor from './SmartCapabilityAdvisor';

export default memo(function TextareaHeader({
  addedConvo,
  setAddedConvo,
}: {
  addedConvo: TConversation | null;
  setAddedConvo: SetterOrUpdater<TConversation | null>;
}) {
  const methods = useChatFormContext();
  const text = useWatch({ control: methods.control, name: 'text' }) ?? '';
  const { conversation, newConversation } = useChatContext();
  const conversationId = conversation?.conversationId ?? Constants.NEW_CONVO;

  return (
    <>
      <SmartCapabilityAdvisor
        text={text}
        conversationId={conversationId}
        currentAgentId={conversation?.agent_id}
        newConversation={newConversation}
      />
      {addedConvo && (
        <div className="m-1.5 flex flex-col divide-y overflow-hidden rounded-b-lg rounded-t-2xl bg-surface-secondary-alt">
          <AddedConvo addedConvo={addedConvo} setAddedConvo={setAddedConvo} />
        </div>
      )}
    </>
  );
});

import {
  forwardRef, ForwardRefRenderFunction, useCallback, useImperativeHandle, useRef, useState,
} from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';

import { ModalBody, ModalFooter, Stack } from '@chakra-ui/react';
import { yupResolver } from '@hookform/resolvers/yup';
import { useMutation } from '@tanstack/react-query';
import * as yup from 'yup';
import { InferType } from 'yup';

import { AddSolidButton } from '~/components/Button/AddSolidButton';
import { CancelOutlineButton } from '~/components/Button/CancelOutlineButton';
import { SaveSolidButton } from '~/components/Button/SaveSolidButton';
import { Input } from '~/components/Form/Input';
import { Modal, ModalHandle } from '~/components/Form/Modal';
import { NumberInput } from '~/components/Form/NumberInput';
import { Switch } from '~/components/Form/Switch';
import { TABLE_PLAYERS } from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import IPlayer from '~/models/Entity/Player/IPlayer';
import IRecordModal from '~/models/Modal/IRecordModal';
import { getPlayer } from '~/services/hooks/usePlayers';
import { queryClient } from '~/services/queryClient';
import supabase from '~/services/supabase';

export type PlayerModalHandle = {
  onOpenModal: (recordModal?: IRecordModal) => void;
};

const PlayerModalBase: ForwardRefRenderFunction<PlayerModalHandle> = (any, ref) => {
  const modalRef = useRef<ModalHandle>(null);

  const { errorFeedbackToast, successFeedbackToast } = useFeedback();
  const [isLoading, setIsLoading] = useState(false);
  const [recordModalProps, setRecordModalProps] = useState<IRecordModal | undefined>({} as IRecordModal);

  const playerSchema = yup.object().shape({
    name: yup.string().min(3).required(),
    username: yup.string().min(3).required(),
    steam_id: yup.string(),
    premier: yup.number().min(0).required(),
    active: yup.boolean().required(),
    fetch_data: yup.boolean().required(),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(playerSchema),
  });

  const onOpenModal = useCallback(
    (recordModal?: IRecordModal) => {
      setRecordModalProps(recordModal);
      if (recordModal?.id) {
        setIsLoading(true);
        getPlayer(recordModal?.id, recordModal?.user.id)
          .then((response) => {
            reset(response);
          })
          .catch((error) => {
            errorFeedbackToast('Jogador', error);
            modalRef.current?.onCloseModal();
          })
          .finally(() => {
            setIsLoading(false);
          });
      } else {
        reset({
          active: true,
        });
      }
      modalRef.current?.onOpenModal();
    },
    [errorFeedbackToast, reset],
  );

  const createOrUpdatePlayer = useMutation(
    {
      mutationFn: async (player: IPlayer) => {
        const {
          id, name, username, premier, active,
        } = player;

        await supabase.from(TABLE_PLAYERS).upsert({
          id,
          user_id: recordModalProps?.user.id,
          name,
          username,
          premier,
          active,
        });
      },
      async onSuccess() {
        successFeedbackToast('Jogador', `${recordModalProps?.id ? 'Atualizado' : 'Cadastrado'} com sucesso!`);
        await queryClient.invalidateQueries({ queryKey: [TABLE_PLAYERS] });
        modalRef.current?.onCloseModal();
      },
      onError(error: Error) {
        errorFeedbackToast('Jogador', error);
      },
    },
  );

  const handleOk: SubmitHandler<InferType<typeof playerSchema>> = async (data) => {
    await createOrUpdatePlayer.mutateAsync(data as IPlayer);
  };

  useImperativeHandle(
    ref,
    () => ({
      onOpenModal,
    }),
    [onOpenModal],
  );

  return (
    <Modal title="Jogador" ref={modalRef} size="md" onSubmit={handleSubmit(handleOk)}>
      <ModalBody>
        <Stack spacing="4">
          <Input
            label="Nome"
            error={errors.name}
            {...register('name')}
            isLoading={isLoading}
            isDisabled={isSubmitting}
            isRequired
            autoFocus
          />
          <Input
            label="Usuário da Steam"
            error={errors.username}
            {...register('username')}
            isLoading={isLoading}
            isDisabled={isSubmitting}
            isRequired
          />
          <Input
            label="Steam ID"
            error={errors.steam_id}
            {...register('steam_id')}
            isLoading={isLoading}
            isDisabled={isSubmitting}
            isRequired
          />
          <NumberInput
            label="Ranking no Premier"
            error={errors.premier}
            {...register('premier')}
            isLoading={isLoading}
            isDisabled={isSubmitting}
            isRequired
          />
          <Stack direction="row" spacing="4">
            <Switch label="Ativo" {...register('active')} isChecked={watch('active')} isDisabled={isLoading || isSubmitting} />
            <Switch label="Buscar Dados" {...register('fetch_data')} isChecked={watch('fetch_data')} isDisabled={isLoading || isSubmitting} />
          </Stack>
        </Stack>
      </ModalBody>
      <ModalFooter flexDir="column" gap="4">
        {recordModalProps?.id ? (
          <SaveSolidButton w="100%" type="submit" isLoading={isSubmitting} isDisabled={isLoading} />
        ) : (
          <AddSolidButton w="100%" type="submit" isLoading={isSubmitting} isDisabled={isLoading} />
        )}
        <CancelOutlineButton w="100%" onClick={() => modalRef.current?.onCloseModal()} isDisabled={isSubmitting || isLoading} />
      </ModalFooter>
    </Modal>
  );
};

export const PlayerModal = forwardRef(PlayerModalBase);
